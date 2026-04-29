/**
 * One-shot: delete zero-byte objects in a Supabase storage bucket via the Storage API
 * (SQL DELETE on storage.objects is blocked by protect_delete triggers).
 *
 * Usage (paste service role key only in your shell, never in the repo):
 *
 *   SUPABASE_URL=https://<project>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<paste-from-vault> \
 *   npx tsx scripts/cleanup-zero-byte-avatars.ts
 *
 * Optional: target a different bucket (default `avatars`):
 *
 *   CLEANUP_BUCKET=highlights \
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/cleanup-zero-byte-avatars.ts
 *
 * Verify afterward in SQL Editor (replace bucket name as needed):
 *   SELECT count(*) FROM storage.objects
 *   WHERE bucket_id = 'avatars'
 *     AND (metadata->>'size')::int = 0
 *     AND name NOT LIKE '%.emptyFolderPlaceholder';
 *   -- expect 0
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BUCKET = (process.env.CLEANUP_BUCKET ?? 'avatars').trim() || 'avatars';
const BATCH_SIZE = 50;

function parseSize(metadata: unknown): number | null {
  if (metadata == null || typeof metadata !== 'object') return null;
  const raw = (metadata as Record<string, unknown>).size;
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function shouldSkipName(name: string): boolean {
  return name.endsWith('.emptyFolderPlaceholder');
}

async function fetchZeroByteNamesViaStorageSchema(
  supabase: SupabaseClient
): Promise<{ names: string[]; source: string; error?: string }> {
  const { data, error } = await supabase
    .schema('storage')
    .from('objects')
    .select('name, metadata')
    .eq('bucket_id', BUCKET);

  if (error) {
    return { names: [], source: 'storage.objects', error: error.message };
  }

  const names: string[] = [];
  for (const row of data ?? []) {
    const name = row?.name as string | undefined;
    if (!name || shouldSkipName(name)) continue;
    const size = parseSize(row?.metadata);
    if (size === 0) names.push(name);
  }
  return { names, source: 'storage.objects' };
}

/**
 * Fallback when `storage.objects` query fails: two-level walk
 * `{segment}/{file}` (avatars, highlights, court-photos, etc.).
 */
async function fetchZeroByteNamesViaListFallback(
  supabase: SupabaseClient
): Promise<{ names: string[]; source: string }> {
  const names: string[] = [];
  const { data: root, error: rootErr } = await supabase.storage.from(BUCKET).list('', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (rootErr) {
    console.error('[cleanup] fallback root list failed:', rootErr.message);
    return { names: [], source: 'storage.list' };
  }

  for (const item of root ?? []) {
    const seg = item.name;
    if (!seg || shouldSkipName(seg)) continue;

    const rootSize = parseSize(item.metadata);
    if (rootSize === 0) names.push(seg);

    const { data: children, error: chErr } = await supabase.storage.from(BUCKET).list(seg, {
      limit: 1000,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (chErr) continue;

    for (const f of children ?? []) {
      if (!f.name) continue;
      const path = `${seg}/${f.name}`;
      if (shouldSkipName(path)) continue;
      const sz = parseSize(f.metadata);
      if (sz === 0) names.push(path);
    }
  }

  return { names, source: 'storage.list(2-level)' };
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceKey) {
    console.error(
      'Missing env: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. Do not put keys in this file.'
    );
    process.exit(1);
  }

  console.log(`[cleanup] bucket=${BUCKET}`);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let { names, source, error: schemaErr } = await fetchZeroByteNamesViaStorageSchema(supabase);

  if (schemaErr) {
    console.warn('[cleanup] storage.objects query failed, using list fallback:', schemaErr);
    const fb = await fetchZeroByteNamesViaListFallback(supabase);
    names = fb.names;
    source = fb.source;
  }

  const unique = [...new Set(names)];
  console.log(`[cleanup] source=${source} zero-byte candidates (excluding placeholders): ${unique.length}`);

  if (unique.length === 0) {
    console.log('[cleanup] nothing to delete.');
    return;
  }

  let deleted = 0;
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const batch = unique.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.storage.from(BUCKET).remove(batch);
    if (error) {
      console.error('[cleanup] remove batch failed:', error.message, batch);
      process.exitCode = 1;
      continue;
    }
    for (const p of batch) {
      console.log('[cleanup] deleted:', p);
      deleted += 1;
    }
  }

  console.log(`[cleanup] finished. removed=${deleted} of ${unique.length} candidates`);
  console.log(
    `[cleanup] verify in SQL Editor:\n` +
      `SELECT count(*) FROM storage.objects\n` +
      `WHERE bucket_id = '${BUCKET}'\n` +
      `  AND (metadata->>'size')::int = 0\n` +
      `  AND name NOT LIKE '%.emptyFolderPlaceholder';`
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
