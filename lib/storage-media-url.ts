/**
 * Supabase Storage URLs for in-app media (images/video).
 *
 * Dashboard checklist if images 403 / never load:
 * - Storage → Buckets: `avatars` and `court-photos` exist.
 * - Each bucket: set **Public bucket** ON if you want anonymous read via `/object/public/...`.
 *   If a bucket is **private**, the app uses **signed URLs** (requires user signed in with valid JWT).
 * - Storage → Policies (objects): allow SELECT for the bucket (see migrations
 *   `20260228190000_avatars_bucket_and_rls.sql`, `20260228180000_court_photos_storage_rls.sql`).
 * - If you **changed Supabase project URL** but kept old rows in `profiles.avatar_url`, URLs pointed at the
 *   old host would fail until you run a DB update or rely on `alignSupabaseStoragePublicUrl` (used below).
 */

import { supabase } from './supabase';
import { supabaseUrl } from './config';
import { normalizeSupabaseStorageObjectRef } from './storage-urls';

const PUBLIC_PREFIX = '/storage/v1/object/public/';
const SIGNED_EXPIRY_SEC = 3600; // 1 hour

/**
 * Rewrites any Supabase project hostname to the one in EXPO_PUBLIC_SUPABASE_URL while keeping
 * `/storage/v1/object/public/{bucket}/...` unchanged. Fixes avatars stored when the project URL changed.
 * Applies {@link normalizeSupabaseStorageObjectRef} first so path-only or legacy DB values become full URLs.
 */
export function alignSupabaseStoragePublicUrl(url: string | null | undefined): string | null {
  const normalized = normalizeSupabaseStorageObjectRef(url);
  if (!normalized || typeof normalized !== 'string' || !normalized.trim()) return null;
  const trimmed = normalized.trim();
  const marker = '/storage/v1/object/public/';
  const idx = trimmed.indexOf(marker);
  if (idx === -1) return trimmed;
  const base = supabaseUrl.replace(/\/$/, '');
  if (!base) return trimmed;
  return `${base}${trimmed.slice(idx)}`;
}

/**
 * For Supabase Storage **public** object URLs: align to the configured project, then request a **signed** URL
 * so private buckets still load in the app. If signing fails, returns the **aligned** public URL (works for
 * public buckets). Non-Supabase URLs are returned unchanged (after trim).
 */
export async function resolveMediaUrlForPlayback(url: string | null | undefined): Promise<string> {
  const aligned = alignSupabaseStoragePublicUrl(url);
  if (!aligned) return '';
  const base = supabaseUrl.replace(/\/$/, '');
  if (!base || !aligned.startsWith(base)) return aligned;
  const rest = aligned.slice(base.length);
  if (!rest.startsWith(PUBLIC_PREFIX)) return aligned;
  const after = rest.slice(PUBLIC_PREFIX.length);
  const firstSlash = after.indexOf('/');
  if (firstSlash <= 0) return aligned;
  const bucket = after.slice(0, firstSlash);
  const path = after.slice(firstSlash + 1);
  if (!path) return aligned;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_EXPIRY_SEC);
    if (!error && data?.signedUrl) return data.signedUrl;
  } catch {
    /* fall through to aligned public URL */
  }
  return aligned;
}
