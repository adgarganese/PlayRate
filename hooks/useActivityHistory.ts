import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getUserLikes,
  getUserComments,
  getUserReposts,
  type ActivityItem,
  type ActivityType,
} from '@/lib/activity-history';
import { UI_LOAD_FAILED } from '@/lib/user-facing-errors';

const PAGE_SIZE = 20;

export type UseActivityHistoryResult = {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  loadMore: () => void;
  hasMore: boolean;
};

async function fetchTabPage(
  userId: string,
  tab: ActivityType,
  offset: number,
  limit: number
): Promise<ActivityItem[]> {
  switch (tab) {
    case 'like':
      return getUserLikes(userId, limit, offset);
    case 'comment':
      return getUserComments(userId, limit, offset);
    case 'repost':
      return getUserReposts(userId, limit, offset);
    default:
      return [];
  }
}

/**
 * Paginated activity (likes / comments / reposts) for a profile. Resets when `userId` or `activeTab` changes.
 */
export function useActivityHistory(
  userId: string,
  activeTab: ActivityType
): UseActivityHistoryResult {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const mountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const nextOffsetRef = useRef(0);
  const userIdRef = useRef(userId);
  const tabRef = useRef(activeTab);
  const requestGenRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runFetch = useCallback(async (append: boolean) => {
    const uid = userIdRef.current;
    const tab = tabRef.current;
    if (!uid || inFlightRef.current) return;

    const genSnapshot = requestGenRef.current;
    inFlightRef.current = true;
    setLoading(true);
    if (!append) {
      setError(null);
    }

    const offset = append ? nextOffsetRef.current : 0;

    try {
      const page = await fetchTabPage(uid, tab, offset, PAGE_SIZE);
      if (!mountedRef.current || genSnapshot !== requestGenRef.current) return;

      if (append) {
        setItems((prev) => [...prev, ...page]);
      } else {
        setItems(page);
      }

      nextOffsetRef.current = offset + page.length;
      setHasMore(page.length === PAGE_SIZE);
      setError(null);
    } catch {
      if (!mountedRef.current || genSnapshot !== requestGenRef.current) return;
      setError(UI_LOAD_FAILED);
      if (!append) {
        setItems([]);
        nextOffsetRef.current = 0;
        setHasMore(false);
      }
    } finally {
      if (genSnapshot === requestGenRef.current) {
        inFlightRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    requestGenRef.current += 1;
    userIdRef.current = userId;
    tabRef.current = activeTab;
    nextOffsetRef.current = 0;
    inFlightRef.current = false;
    setHasMore(true);
    setItems([]);
    setError(null);

    if (!userId) {
      setLoading(false);
      setHasMore(false);
      return;
    }

    void runFetch(false);
  }, [userId, activeTab, runFetch]);

  const loadMore = useCallback(() => {
    if (!userId || !hasMore || loading || inFlightRef.current) return;
    void runFetch(true);
  }, [userId, hasMore, loading, runFetch]);

  return {
    items,
    loading,
    error,
    loadMore,
    hasMore,
  };
}
