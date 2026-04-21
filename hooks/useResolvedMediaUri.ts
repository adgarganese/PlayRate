import { useEffect, useMemo, useState } from 'react';
import {
  alignSupabaseStoragePublicUrl,
  resolveMediaUrlForPlayback,
} from '@/lib/storage-media-url';

/**
 * Stable URI for expo-image: aligned Supabase host immediately, then signed URL when available.
 */
export function useResolvedMediaUri(raw: string | null | undefined): string | null {
  const syncUri = useMemo(() => {
    if (!raw?.trim()) return null;
    return alignSupabaseStoragePublicUrl(raw);
  }, [raw]);

  const [asyncUri, setAsyncUri] = useState<string | null>(null);

  useEffect(() => {
    setAsyncUri(null);
    const t = raw?.trim();
    if (!t) {
      return;
    }
    let cancelled = false;
    void resolveMediaUrlForPlayback(t)
      .then((u) => {
        if (!cancelled && u.length > 0) setAsyncUri(u);
      })
      .catch(() => {
        /* resolveMediaUrlForPlayback should not throw; guard against unexpected rejections */
      });
    return () => {
      cancelled = true;
    };
  }, [raw]);

  // Prefer signed URL when non-empty; ignore async '' so we don't drop a valid syncUri (expo-image treats '' as no image).
  return (asyncUri && asyncUri.length > 0) ? asyncUri : syncUri;
}
