import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { loadHighlightsFeed, type FeedHighlight } from '@/lib/highlights';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { ProfilePicture } from '@/components/ProfilePicture';
import { HighlightPoster } from '@/components/HighlightPoster';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';

const PAGE_SIZE = 20;

export default function AthleteHighlightsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const [highlights, setHighlights] = useState<FeedHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadFeed = useCallback(async (offset = 0, append = false) => {
    if (!userId || !user) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = await loadHighlightsFeed(
        'friends_local',
        user.id,
        offset,
        PAGE_SIZE,
        { followingIds: [userId] }
      );

      if (result.error) {
        setError(result.error);
        if (!append) setHighlights([]);
      } else {
        const items = result.highlights ?? [];
        setHighlights((prev) => (append ? [...prev, ...items] : items));
        setHasMore(result.hasMore ?? false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      setError(message);
      if (!append) setHighlights([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    if (userId && user) {
      loadFeed(0, false);
    }
  }, [userId, user?.id, loadFeed]);

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadFeed(highlights.length, true);
    }
  };

  const openHighlight = (highlightId: string) => {
    router.push(`/highlights/${highlightId}` as any);
  };

  if (authLoading) return null;
  if (!user) return <Redirect href="/sign-in" />;
  if (!userId) return null;

  return (
    <Screen>
      <Header title="Highlights" showBack />
      {loading && highlights.length === 0 ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading highlights…</Text>
        </View>
      ) : error && highlights.length === 0 ? (
        <View style={[styles.center, styles.errorBlock, { flex: 1 }]}>
          <AppText variant="body" color="textMuted" style={styles.errorText}>
            {error}
          </AppText>
        </View>
      ) : (
        <FlatList
          data={highlights}
          keyExtractor={(item) => item.id}
          contentContainerStyle={highlights.length === 0 ? styles.emptyList : styles.list}
          renderItem={({ item }) => (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => openHighlight(item.id)} activeOpacity={0.8}>
                <View style={styles.cardHeader}>
                  <ProfilePicture avatarUrl={item.profile_avatar_url} size={36} editable={false} />
                  <View style={styles.cardHeaderText}>
                    <AppText variant="bodyBold" color="text" numberOfLines={1}>
                      {item.profile_name || item.profile_username || 'User'}
                    </AppText>
                    {item.sport ? (
                      <AppText variant="mutedSmall" color="textMuted">{item.sport}</AppText>
                    ) : null}
                  </View>
                </View>
                <HighlightPoster
                  thumbnailUrl={item.thumbnail_url}
                  mediaUrl={item.media_url}
                  mediaType={item.media_type}
                />
                {item.caption ? (
                  <AppText variant="body" color="text" style={styles.caption} numberOfLines={2}>
                    {item.caption}
                  </AppText>
                ) : null}
              </TouchableOpacity>
              <View style={styles.stats}>
                <IconSymbol name="heart.fill" size={14} color={item.is_liked ? colors.primary : colors.textMuted} />
                <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.like_count}</AppText>
                <IconSymbol name="bubble.left.fill" size={14} color={colors.textMuted} style={styles.statIcon} />
                <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.comment_count ?? 0}</AppText>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No highlights yet"
              subtitle="This athlete hasn't posted any highlights."
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    fontSize: 16,
  },
  errorBlock: {
    padding: Spacing.lg,
  },
  errorText: {
    textAlign: 'center',
  },
  list: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl + 64,
  },
  emptyList: {
    flexGrow: 1,
    padding: Spacing.lg,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  caption: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    gap: 4,
  },
  statText: {
    marginRight: Spacing.sm,
  },
  statIcon: {
    marginLeft: 4,
  },
  footerLoader: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
});
