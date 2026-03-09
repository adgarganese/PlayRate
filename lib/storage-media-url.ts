/**
 * Resolve a Supabase storage URL for in-app playback.
 * If the bucket is private, getPublicUrl() returns a URL that may redirect to auth in browsers.
 * This helper returns a signed URL so Video/Image components load media in-app.
 */

import { supabase } from './supabase';
import { supabaseUrl } from './config';

const PUBLIC_PREFIX = '/storage/v1/object/public/';
const SIGNED_EXPIRY_SEC = 3600; // 1 hour

/**
 * If url is a Supabase storage public URL, returns a signed URL for in-app playback.
 * Otherwise returns the original url. On error returns the original url.
 */
export async function resolveMediaUrlForPlayback(url: string | null | undefined): Promise<string> {
  if (!url || typeof url !== 'string' || !url.trim()) return url || '';
  const base = supabaseUrl.replace(/\/$/, '');
  if (!url.startsWith(base)) return url;
  const rest = url.slice(base.length);
  if (!rest.startsWith(PUBLIC_PREFIX)) return url;
  const after = rest.slice(PUBLIC_PREFIX.length);
  const firstSlash = after.indexOf('/');
  if (firstSlash <= 0) return url;
  const bucket = after.slice(0, firstSlash);
  const path = after.slice(firstSlash + 1);
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_EXPIRY_SEC);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}
