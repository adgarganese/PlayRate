import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { createInAppNotification } from '@/lib/create-in-app-notification';
import { UI_FOLLOW_FAILED } from '@/lib/user-facing-errors';
import { isRpcRateLimitError, RPC_RATE_LIMIT_USER_MESSAGE } from '@/lib/rpc-rate-limit';
import { track } from '@/lib/analytics';
import { useAuth } from '@/contexts/auth-context';
import { hapticLight } from '@/lib/haptics';

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
    const followerId = user?.id;
    if (!followerId || !targetUserId) return;

    try {
      const { data, error } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', followerId)
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
    const uid = user?.id;
    if (!uid || !targetUserId) return;
    if (uid === targetUserId) return;

    const wasFollowing = isFollowing;
    hapticLight();
    // Optimistic update
    setIsFollowing(!wasFollowing);
    setFollowersCount((prev) => (prev !== null ? prev + (wasFollowing ? -1 : 1) : 0));
    setToggleLoading(true);

    try {
      const { error } = await supabase.rpc('toggle_follow', {
        target_user: targetUserId,
      });

      if (error) {
        if (isRpcRateLimitError(error)) {
          setIsFollowing(wasFollowing);
          setFollowersCount((prev) => (prev !== null ? prev + (wasFollowing ? 1 : -1) : 0));
          await fetchCounts();
          Alert.alert('Slow down', RPC_RATE_LIMIT_USER_MESSAGE);
          return;
        }
        throw error;
      }

      if (!wasFollowing) {
        track('follow_added', {});
        const { data: meProf } = await supabase
          .from('profiles')
          .select('name, username')
          .eq('user_id', uid)
          .maybeSingle();
        const label = meProf?.name?.trim() || meProf?.username || 'Someone';
        await createInAppNotification({
          userId: targetUserId,
          actorId: uid,
          type: 'new_follower',
          entityType: 'user',
          entityId: uid,
          title: `${label} started following you`,
          body: null,
        });
      }

      // Re-fetch to ensure consistency with server
      await fetchCounts();
      await fetchIsFollowing();
    } catch (err: unknown) {
      // Rollback optimistic update
      setIsFollowing(wasFollowing);
      setFollowersCount((prev) => (prev !== null ? prev + (wasFollowing ? 1 : -1) : 0));
      await fetchCounts();

      if (__DEV__) {
        logger.warn('[useFollow] toggleFollow failed', { err });
      }
      Alert.alert('Error', UI_FOLLOW_FAILED);
    } finally {
      setToggleLoading(false);
    }
  }, [user?.id, targetUserId, isFollowing, fetchCounts, fetchIsFollowing]);

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
