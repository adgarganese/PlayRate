import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { ListItem } from '@/components/ui/ListItem';
import { ProfilePicture } from '@/components/ProfilePicture';
import { EmptyState } from '@/components/ui/EmptyState';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

const PAGE_SIZE = 25;

type ProfileUser = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

export default function FollowingScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { colors } = useThemeColors();
  const [profiles, setProfiles] = useState<ProfileUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadFollowing = useCallback(async (isLoadMore = false, currentOffset = 0) => {
    if (!userId) return;

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {

      const { data: followsData, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .range(currentOffset, currentOffset + PAGE_SIZE - 1)
        .order('created_at', { ascending: false });

      if (followsError) {
        setError(followsError.message);
        setProfiles([]);
        return;
      }

      const followingIds = (followsData || []).map((f) => f.following_id);

      if (followingIds.length === 0 && !isLoadMore) {
        setProfiles([]);
        setHasMore(false);
        return;
      }

      if (followingIds.length < PAGE_SIZE) {
        setHasMore(false);
      }

      if (followingIds.length === 0) {
        if (isLoadMore) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
        return;
      }

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, username, avatar_url')
        .in('user_id', followingIds);

      if (profilesError) {
        setError(profilesError.message);
        return;
      }

      const profileMap = new Map<string, ProfileUser>();
      (profilesData || []).forEach((p) => profileMap.set(p.user_id, p));

      const orderedProfiles = followingIds
        .map((id) => profileMap.get(id))
        .filter(Boolean) as ProfileUser[];

      if (isLoadMore) {
        setProfiles((prev) => {
          const seen = new Set(prev.map((p) => p.user_id));
          const newOnes = orderedProfiles.filter((p) => !seen.has(p.user_id));
          return [...prev, ...newOnes];
        });
      } else {
        setProfiles(orderedProfiles);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load following');
      setProfiles([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      loadFollowing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const handleProfilePress = (profileUserId: string) => {
    router.push(`/athletes/${profileUserId}/profile` as any);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadFollowing(true, profiles.length);
    }
  };

  if (!userId) {
    return (
      <Screen>
        <Header title="Following" showBack={false} />
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>Invalid profile</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Following" showBack={false} />
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading following...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.user_id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => handleProfilePress(item.user_id)}
            >
              <ListItem
                title={item.name ?? 'No name'}
                subtitle={`@${item.username ?? 'no-username'}`}
                showChevron
                leftContent={
                  <ProfilePicture
                    avatarUrl={item.avatar_url}
                    size={44}
                    editable={false}
                  />
                }
              />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Not following anyone"
              subtitle="When this profile follows others, they'll show up here."
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
