/**
 * Canonical handling for Supabase Storage URLs stored in the DB (avatars, court photos, highlights).
 * Some rows may hold a full public URL, others only the object path inside a bucket — normalize before
 * align/sign steps in {@link ./storage-media-url}.
 */

import { supabaseUrl } from '@/lib/config';

const PUBLIC_OBJECT_PREFIX = '/storage/v1/object/public/';

const UUID =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

/** Buckets the app reads via public object URLs (must match Supabase Storage bucket ids). */
const KNOWN_BUCKETS = [
  'avatars',
  'court-photos',
  'highlights',
  'highlights-drafts',
] as const;

function stripOuterQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * If `raw` is already an absolute URL, returns it trimmed (caller may align host).
 * If it is a storage object path (with or without `{bucket}/` prefix), returns a full
 * `https://{project}/storage/v1/object/public/{bucket}/{path}` URL using {@link supabaseUrl}.
 */
export function normalizeSupabaseStorageObjectRef(raw: string | null | undefined): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  const stripped = stripOuterQuotes(raw);
  if (!stripped) return null;

  if (/^(https?|file|content|ph|data|blob):/i.test(stripped)) {
    return stripped;
  }

  const base = supabaseUrl.replace(/\/$/, '');
  if (!base) return stripped;

  const lower = stripped.toLowerCase();
  for (const bucket of KNOWN_BUCKETS) {
    const prefix = `${bucket}/`;
    if (lower.startsWith(prefix)) {
      const pathInside = stripped.slice(bucket.length + 1);
      if (!pathInside) return null;
      return `${base}${PUBLIC_OBJECT_PREFIX}${bucket}/${pathInside}`;
    }
  }

  // Court photos table stores `{court_id}/{user_id}/{file}` (no bucket prefix).
  const courtPath = new RegExp(`^${UUID}/${UUID}/`, 'i');
  if (courtPath.test(stripped)) {
    return `${base}${PUBLIC_OBJECT_PREFIX}court-photos/${stripped}`;
  }

  // Avatars are stored as `{user_id}/{timestamp}.jpg` (single leading UUID folder).
  const avatarPath = new RegExp(`^${UUID}/`, 'i');
  if (avatarPath.test(stripped)) {
    return `${base}${PUBLIC_OBJECT_PREFIX}avatars/${stripped}`;
  }

  return stripped;
}
