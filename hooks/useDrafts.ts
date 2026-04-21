import { useCallback, useEffect, useRef, useState } from 'react';
import { getDrafts, type HighlightDraft } from '@/lib/highlight-drafts';

export type UseDraftsResult = {
  drafts: HighlightDraft[];
  loading: boolean;
  refresh: () => Promise<void>;
};

/**
 * Loads highlight drafts for the signed-in user. Call `refresh` after publish/delete or on screen focus.
 */
export function useDrafts(userId: string | null): UseDraftsResult {
  const [drafts, setDrafts] = useState<HighlightDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) setDrafts([]);
      return;
    }
    setLoading(true);
    try {
      const list = await getDrafts(userId);
      if (mountedRef.current) setDrafts(list);
    } catch (e) {
      if (__DEV__) console.warn('[useDrafts] refresh failed', e);
      if (mountedRef.current) setDrafts([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { drafts, loading, refresh };
}
