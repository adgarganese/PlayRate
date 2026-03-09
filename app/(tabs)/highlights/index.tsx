import { useEffect, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Share, Alert, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Video, ResizeMode } from 'expo-av';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfilePicture } from '@/components/ProfilePicture';
import { HighlightPoster } from '@/components/HighlightPoster';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { loadHighlightsFeed, toggleHighlightLike, formatViewCount, type FeedHighlight } from '@/lib/highlights';
import { resolveMediaUrlForPlayback } from '@/lib/storage-media-url';
import { useTabBarSafeBottom } from '@/hooks/use-tab-bar-safe-bottom';

const FEED_MEDIA_MAX_HEIGHT = Math.min(440, Dimensions.get('window').height * 0.48);

const FEED_PAGE_SIZE = 20;

export default function HighlightsFeedScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const fabBottom = useTabBarSafeBottom(Spacing.lg);
  const [highlights, setHighlights] = useState<FeedHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleHighlightId, setVisibleHighlightId] = useState<string | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    if (__DEV__) console.log('[HighlightsFeed] fetch start');
    setLoading(true);
    setError(null);
    try {
      const result = await loadHighlightsFeed(
        'all',
        user?.id ?? null,
        0,
        FEED_PAGE_SIZE
      );
      if (__DEV__) {
        console.log('[HighlightsFeed] fetch end', {
          count: result.highlights?.length ?? 0,
          error: result.error ?? null,
        });
      }
      if (result.error) {
        setError(result.error);
        setHighlights([]);
      } else {
        setHighlights(result.highlights ?? []);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load';
      if (__DEV__) console.log('[HighlightsFeed] fetch error', message);
      setError(message);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    loadFeed();
  }, [authLoading, loadFeed]);

  // Refetch when screen gains focus so comment counts are correct after returning from comments
  useFocusEffect(
    useCallback(() => {
      if (authLoading) return;
      loadFeed();
    }, [authLoading, loadFeed])
  );

  const handleRetry = () => {
    loadFeed();
  };

  const openHighlight = (highlightId: string) => {
    router.push(`/highlights/${highlightId}` as any);
  };

  const openCreate = () => {
    router.push('/highlights/create' as any);
  };

  const handleShare = async (item: FeedHighlight) => {
    try {
      await Share.share({
        title: 'Highlight',
        message: `Check out this highlight. playrate://profile/highlights/${item.id}`,
      });
    } catch (error) {
      if (__DEV__) console.warn('[highlights:share]', error);
    }
  };

  const handleDm = (highlightId: string) => {
    if (!user) {
      Alert.alert('Sign In Required', 'Sign in to send highlights via DM.');
      return;
    }
    router.push({ pathname: '/highlights/send-dm', params: { highlightId } } as any);
  };

  const handleLikePress = useCallback(
    async (item: FeedHighlight) => {
      if (!user) return;
      const { success, newLikedState } = await toggleHighlightLike(item.id, user.id, item.is_liked);
      if (success) {
        setHighlights((prev) =>
          prev.map((h) =>
            h.id === item.id
              ? { ...h, is_liked: newLikedState, like_count: h.like_count + (newLikedState ? 1 : -1) }
              : h
          )
        );
      }
    },
    [user]
  );

  const handleCommentPress = useCallback((highlightId: string) => {
    router.push(`/highlights/${highlightId}/comments` as any);
  }, [router]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: FeedHighlight; index: number | null }[] }) => {
    const first = viewableItems[0];
    const id = first?.item?.id ?? null;
    setVisibleHighlightId((prev) => {
      if (prev === id) return prev;
      return id;
    });
  }).current;

  useEffect(() => {
    if (!visibleHighlightId || !highlights.length) {
      setResolvedVideoUrl(null);
      return;
    }
    const h = highlights.find((x) => x.id === visibleHighlightId);
    if (!h || h.media_type !== 'video') {
      setResolvedVideoUrl(null);
      return;
    }
    setResolvedVideoUrl(null); // clear so we don't show previous video's URL while resolving this one
    let cancelled = false;
    resolveMediaUrlForPlayback(h.media_url)
      .then((url) => { if (!cancelled) setResolvedVideoUrl(url); })
      .catch(() => { if (!cancelled) setResolvedVideoUrl(null); });
    return () => { cancelled = true; };
  }, [visibleHighlightId, highlights]);

  const renderFeedCard = useCallback(
    ({ item, index }: { item: FeedHighlight; index: number }) => {
      const isVisibleVideo = item.id === visibleHighlightId && item.media_type === 'video' && resolvedVideoUrl;
      return (
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
            <View style={[styles.feedMediaWrap, { maxHeight: FEED_MEDIA_MAX_HEIGHT }]}>
              {isVisibleVideo ? (
                <Video
                  source={{ uri: resolvedVideoUrl }}
                  style={styles.feedVideo}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                  shouldPlay
                  isMuted
                />
              ) : (
                <HighlightPoster
                  thumbnailUrl={item.thumbnail_url}
                  mediaUrl={item.media_url}
                  mediaType={item.media_type}
                  style={styles.feedPoster}
                />
              )}
            </View>
            {item.caption ? (
              <AppText variant="body" color="text" style={styles.caption} numberOfLines={2}>
                {item.caption}
              </AppText>
            ) : null}
          </TouchableOpacity>
          <View style={styles.stats}>
            {(item.view_count ?? 0) > 0 ? (
              <View style={styles.statAction}>
                <IconSymbol name="eye.fill" size={14} color={colors.textMuted} />
                <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>
                  {formatViewCount(item.view_count ?? 0)}
                </AppText>
              </View>
            ) : null}
            <TouchableOpacity
              style={styles.statAction}
              onPress={() => handleLikePress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel={item.is_liked ? 'Unlike' : 'Like'}
            >
              <IconSymbol name="heart.fill" size={14} color={item.is_liked ? colors.primary : colors.textMuted} />
              <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.like_count}</AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.statAction}
              onPress={() => handleCommentPress(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Comments"
            >
              <IconSymbol name="bubble.left.fill" size={14} color={colors.textMuted} style={styles.statIcon} />
              <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.comment_count ?? 0}</AppText>
            </TouchableOpacity>
            <View style={styles.actionIcons}>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleDm(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Send via DM"
            >
              <IconSymbol name="envelope.fill" size={18} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionIconBtn}
              onPress={() => handleShare(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Share highlight"
            >
              <IconSymbol name="square.and.arrow.up" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
    },
    [colors, visibleHighlightId, resolvedVideoUrl, openHighlight, handleDm, handleShare, handleLikePress, handleCommentPress]
  );

  if (authLoading) {
    return (
      <Screen>
        <Header title="Highlights" showBack={false} />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading…</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Highlights" showBack={false} />
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
          <Button title="Retry" onPress={handleRetry} variant="primary" style={styles.retryButton} />
        </View>
      ) : (
        <>
        <FlatList
          data={highlights}
          keyExtractor={(item) => item.id}
          contentContainerStyle={highlights.length === 0 ? styles.emptyList : styles.list}
          renderItem={renderFeedCard}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
          onViewableItemsChanged={onViewableItemsChanged}
          ListEmptyComponent={
            <EmptyState
              title="No highlights yet"
              subtitle="Highlights from the community will appear here."
            />
          }
        />
        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom: fabBottom,
              right: Spacing.lg,
              backgroundColor: colors.primary,
            },
          ]}
          onPress={openCreate}
          activeOpacity={0.8}
          accessibilityLabel="Create highlight"
          accessibilityRole="button"
        >
          <IconSymbol name="plus" size={28} color="#fff" />
        </TouchableOpacity>
        </>
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
    ...Typography.body,
  },
  errorBlock: {
    padding: Spacing.lg,
  },
  errorText: {
    textAlign: 'center',
  },
  retryButton: {
    marginTop: Spacing.md,
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
    borderRadius: Radius.md,
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
  mediaWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    maxHeight: 360,
  },
  feedMediaWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#000',
  },
  feedVideo: {
    width: '100%',
    height: '100%',
  },
  feedPoster: {
    width: '100%',
    height: '100%',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  mediaPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
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
  statAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    marginRight: Spacing.sm,
  },
  statIcon: {
    marginLeft: Spacing.xs,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: Spacing.sm,
  },
  actionIconBtn: {
    padding: Spacing.xs,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
