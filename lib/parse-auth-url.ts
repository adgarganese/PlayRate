import * as Linking from 'expo-linking';

/** Query string + URL hash (Supabase often puts tokens in the fragment). */
export function mergeQueryAndHash(url: string): Record<string, string> {
  const parsed = Linking.parse(url);
  const out: Record<string, string> = {};
  if (parsed.queryParams) {
    for (const [k, v] of Object.entries(parsed.queryParams)) {
      if (v != null && v !== '') out[k] = String(v);
    }
  }
  const hashIdx = url.indexOf('#');
  if (hashIdx >= 0) {
    const fragment = url.slice(hashIdx + 1);
    for (const [k, v] of new URLSearchParams(fragment)) {
      if (v) out[k] = v;
    }
  }
  return out;
}

/** True when URL is an auth redirect target (custom scheme or universal link). */
export function isAuthCallbackUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes('auth/callback');
}
