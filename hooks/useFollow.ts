import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/auth-context';

type FollowCounts = {
  followers: number;
  following: number;
};

export function useFollow(targetUserId: string | null | undefined) {
  const { user } = useAuth();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!targetUserId) return;

    try {
      const { data, error } = await supabase.rpc('get_follow_counts', {
        target_user: targetUserId,
      });

      if (error) {
        // Fallback: count client-side if RPC doesn't exist yet
        const { count: followers } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId);

        const { count: following } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', targetUserId);

        setFollowersCount(followers ?? 0);
        setFollowingCount(following ?? 0);
        return;
      }

      const counts = data as FollowCounts;
      setFollowersCount(counts?.followers ?? 0);
      setFollowingCount(counts?.following ?? 0);
    } catch (err) {
      if (__DEV__) console.error('Error fetching follow counts:', err);
      setFollowersCount(0);
      setFollowingCount(0);
    }
  }, [targetUserId]);

  const fetchIsFollowing = useCallback(async () => {
    if (!user || !targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)
        .maybeSingle();

      if (!error) {
        setIsFollowing(!!data);
      }
    } catch (err) {
      if (__DEV__) console.error('Error fetching isFollowing:', err);
      setIsFollowing(false);
    }
  }, [user?.id, targetUserId]);

  const load = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    try {
      await Promise.all([fetchCounts(), fetchIsFollowing()]);
    } finally {
      setLoading(false);
    }
  }, [targetUserId, fetchCounts, fetchIsFollowing]);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh on screen focus (e.g. returning from followers page)
  useFocusEffect(
    useCallback(() => {
      if (targetUserId) {
        fetchCounts();
        fetchIsFollowing();
      }
    }, [targetUserId, fetchCounts, fetchIsFollowing])
  );

  const toggleFollow = useCallback(async () => {
    if (!user || !targetUserId) return;
    if (user.id === targetUserId) return;

    const wasFollowing = isFollowing;
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => (prev !== null ? prev + (wasFollowing ? -1 : 1) : 0));
    setToggleLoading(true);

    try {
      const { error } = await supabase.rpc('toggle_follow', {
        target_user: targetUserId,
      });

      if (error) {
        throw error;
      }

      if (!wasFollowing) {
        track('follow_created', { target_user_id: targetUserId });
      }

      // Re-fetch to ensure consistency with server
      await fetchCounts();
      await fetchIsFollowing();
    } catch (err: unknown) {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setFollowersCount((prev) => (prev !== null ? prev + (wasFollowing ? 1 : -1) : 0));
      await fetchCounts();

      const message = err instanceof Error ? err.message : 'Failed to update follow. Please try again.';
      Alert.alert('Error', message);
    } finally {
      setToggleLoading(false);
    }
  }, [user?.id, targetUserId, isFollowing, fetchCounts]);

  return {
    isFollowing,
    followersCount: followersCount ?? 0,
    followingCount: followingCount ?? 0,
    toggleFollow,
    loading,
    toggleLoading,
    refresh: load,
  };
}
