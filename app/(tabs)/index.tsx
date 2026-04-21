/**
 * REINTRODUCTION STEP 1: Real Home screen restored. Other tabs remain placeholders.
 * Build-20 stable baseline. No haptics / tab styling added.
 */
import { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react';
import { StyleSheet, ScrollView, View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/auth-context';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { supabase } from '@/lib/supabase';
import { fetchRecommendedRuns, type RecommendedCourtItem } from '@/lib/courts';
import { loadHighlightsFeed, type FeedHighlight } from '@/lib/highlights';
import { Screen } from '@/components/ui/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { SectionTitle } from '@/components/SectionTitle';
import { SectionAccent } from '@/components/ui/SectionAccent';
import { GradientCard } from '@/components/ui/GradientCard';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { PlayRateSnapshotCard } from '@/components/PlayRateSnapshotCard';
import { RunListItem } from '@/components/RunListItem';
import { RecommendedFriendItem } from '@/components/RecommendedFriendItem';
import { Card } from '@/components/Card';
import { CompactEmptyStateCard } from '@/components/ui/CompactEmptyStateCard';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PlayRatePlaceholder } from '@/components/PlayRatePlaceholder';
import { NotificationsAndInboxIcons } from '@/components/NotificationsAndInboxIcons';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { track, trackOnce } from '@/lib/analytics';
import { logDevError } from '@/lib/dev-log';
import { ATHLETES_TAB_ROUTE } from '@/constants/routes';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';

const HIGHLIGHTS_PREVIEW_LIMIT = 6;
const HIGHLIGHT_VIDEO_TILE_FALLBACK_BG = '#0B0F1A';
const HOME_HIGHLIGHT_PREVIEW_TILE_PX = 112;
const HOME_PREVIEW_IMAGE_TRANSITION_MS = 160;
const RECOMMENDED_FRIENDS_MAX = 3;
const FRIENDS_QUERY_LIMIT = 15;

type RecommendedFriend = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  rep_level: string | null;
  created_at: string;
};

const HomeHighlightPreviewTile = memo(function HomeHighlightPreviewTile({
  item,
  onPress,
}: {
  item: FeedHighlight;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  const [imageFailed, setImageFailed] = useState(false);
  const loadFailedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    loadFailedRef.current = false;
    setImageFailed(false);
    return () => {
      mountedRef.current = false;
    };
  }, [item.id, item.thumbnail_url, item.media_url]);

  const rawMediaUri = useMemo(() => {
    if (imageFailed) return null;
    return pickHighlightStillImageRaw(item.thumbnail_url, item.media_url, item.media_type);
  }, [item.thumbnail_url, item.media_url, item.media_type, imageFailed]);

  const displayUri = useResolvedMediaUri(rawMediaUri);

  return (
    <AnimatedPressable
      style={[styles.highlightTile, { borderColor: colors.border }]}
      onPress={onPress}
    >
      <GradientCard
        variant="subtle"
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          padding: 0,
          borderWidth: 0,
          borderRadius: Radius.sm,
        }}
      >
        {displayUri ? (
          <Image
            source={{ uri: displayUri }}
            style={styles.highlightTileImage}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={HOME_PREVIEW_IMAGE_TRANSITION_MS}
            recyclingKey={`${item.id}-${displayUri}`}
            onError={() => {
              if (loadFailedRef.current) return;
              loadFailedRef.current = true;
              if (mountedRef.current) setImageFailed(true);
            }}
          />
        ) : (
          <View
            style={[
              styles.highlightTilePlaceholder,
              {
                backgroundColor:
                  item.media_type === 'video' ? HIGHLIGHT_VIDEO_TILE_FALLBACK_BG : colors.surface,
              },
            ]}
          >
            <IconSymbol
              name={item.media_type === 'video' ? 'play.rectangle.fill' : 'photo'}
              size={26}
              color={item.media_type === 'video' ? 'rgba(255,255,255,0.88)' : colors.textMuted}
            />
            {item.caption ? (
              <Text
                numberOfLines={2}
                style={[
                  styles.highlightTilePlaceholderCaption,
                  {
                    color: item.media_type === 'video' ? 'rgba(255,255,255,0.7)' : colors.textMuted,
                  },
                ]}
              >
                {item.caption}
              </Text>
            ) : null}
          </View>
        )}
        {item.media_type === 'video' ? (
          <View style={styles.highlightTilePlayBadge}>
            <IconSymbol name="play.fill" size={10} color="#fff" />
          </View>
        ) : null}
      </GradientCard>
    </AnimatedPressable>
  );
});

/** Broader profiles query when primary errors or returns 0. Excludes self and followed. */
async function fetchRecommendedFriendsFallback(
  userId: string,
  followingIds: Set<string>
): Promise<RecommendedFriend[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, username, avatar_url, rep_level, created_at')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(FRIENDS_QUERY_LIMIT);
  if (error || !data?.length) return [];
  return (data as RecommendedFriend[]).filter(
    (p) => p.user_id !== userId && !followingIds.has(p.user_id)
  );
}

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [recommendedFriends, setRecommendedFriends] = useState<RecommendedFriend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [recommendedRuns, setRecommendedRuns] = useState<RecommendedCourtItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [highlightsPreview, setHighlightsPreview] = useState<FeedHighlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [runsLoadError, setRunsLoadError] = useState(false);
  const [friendsLoadError, setFriendsLoadError] = useState(false);
  const [highlightsLoadError, setHighlightsLoadError] = useState(false);
  const homeViewedFired = useRef(false);
  const runRecommendationsViewedFired = useRef(false);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);

  const loadRecommendedRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsLoadError(false);
    try {
      let userLat: number | null = null;
      let userLng: number | null = null;
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({});
          userLat = loc.coords.latitude;
          userLng = loc.coords.longitude;
        }
      } catch (error) {
        if (__DEV__) console.warn('[home:loadRecommendedRuns] location', error);
      }
      const runs = await fetchRecommendedRuns(userLat, userLng);
      setRecommendedRuns(runs);
    } catch (error) {
      logDevError('home:loadRecommendedRuns', error);
      setRunsLoadError(true);
      setRecommendedRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  const loadRecommendedFriends = useCallback(async () => {
    if (!user) {
      setRecommendedFriends([]);
      return;
    }

    setLoadingFriends(true);
    setFriendsLoadError(false);
    let list: RecommendedFriend[] = [];
    let followingIds = new Set<string>();
    try {
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);
      followingIds = new Set((followingData ?? []).map((f) => f.following_id));
      const excludeIds = [user.id, ...followingIds];

      const primary = await supabase
        .from('profiles')
        .select('user_id, name, username, avatar_url, rep_level, created_at')
        .not('user_id', 'in', `(${excludeIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(FRIENDS_QUERY_LIMIT);

      if (!primary.error && primary.data?.length) {
        list = primary.data as RecommendedFriend[];
      } else {
        list = await fetchRecommendedFriendsFallback(user.id, followingIds);
      }
    } catch (err) {
      logDevError('home:loadRecommendedFriends', err);
      try {
        list = await fetchRecommendedFriendsFallback(user.id, followingIds);
      } catch (fallbackErr) {
        logDevError('home:loadRecommendedFriends:fallback', fallbackErr);
        setFriendsLoadError(true);
      }
    } finally {
      setRecommendedFriends(list.slice(0, RECOMMENDED_FRIENDS_MAX));
      setLoadingFriends(false);
    }
  }, [user]);

  const loadHighlightsPreview = useCallback(async () => {
    setLoadingHighlights(true);
    setHighlightsLoadError(false);
    try {
      const result = await loadHighlightsFeed(
        'all',
        user?.id ?? null,
        0,
        HIGHLIGHTS_PREVIEW_LIMIT
      );
      if (!result.error) {
        setHighlightsPreview(result.highlights ?? []);
      } else {
        setHighlightsLoadError(true);
        setHighlightsPreview([]);
      }
    } catch (error) {
      logDevError('home:loadHighlightsPreview', error);
      setHighlightsLoadError(true);
      setHighlightsPreview([]);
    } finally {
      setLoadingHighlights(false);
    }
  }, [user?.id]);

  const renderHighlightPreviewItem = useCallback(
    ({ item, index }: { item: FeedHighlight; index: number }) => (
      <AnimatedListItem index={index}>
        <View style={styles.homeHighlightPreviewColumn}>
          {item.reposted_by_username ? (
            <Text
              numberOfLines={1}
              style={[
                Typography.mutedSmall,
                { color: colors.textMuted, marginBottom: 4, maxWidth: HOME_HIGHLIGHT_PREVIEW_TILE_PX + 8 },
              ]}
            >
              ↻ Reposted by {item.reposted_by_username}
            </Text>
          ) : null}
          <HomeHighlightPreviewTile
            item={item}
            onPress={() => router.push(`/highlights/${item.id}`)}
          />
        </View>
      </AnimatedListItem>
    ),
    [router, colors.textMuted]
  );

  useEffect(() => {
    if (user && !homeViewedFired.current) {
      homeViewedFired.current = true;
      trackOnce('home_viewed', 'mount');
    }
  }, [user]);

  useEffect(() => {
    if (
      !loadingRuns &&
      !runRecommendationsViewedFired.current &&
      hasInitialLoadCompleted
    ) {
      runRecommendationsViewedFired.current = true;
      track('run_recommendations_viewed', { count: recommendedRuns.length });
    }
  }, [loadingRuns, recommendedRuns.length, hasInitialLoadCompleted]);

  const INITIAL_LOAD_TIMEOUT_MS = 12000;

  useEffect(() => {
    if (!user) {
      setHasInitialLoadCompleted(false);
      return;
    }
    setHasInitialLoadCompleted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset gate when user id changes; `user` object alone can churn without id change
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;
      let cancelled = false;
      const safetyTimeout = setTimeout(() => {
        if (!cancelled) setHasInitialLoadCompleted(true);
      }, INITIAL_LOAD_TIMEOUT_MS);

      void (async () => {
        try {
          await Promise.all([
            loadRecommendedFriends(),
            loadRecommendedRuns(),
            loadHighlightsPreview(),
          ]);
        } finally {
          if (!cancelled) {
            clearTimeout(safetyTimeout);
            setHasInitialLoadCompleted(true);
          }
        }
      })();

      return () => {
        cancelled = true;
        clearTimeout(safetyTimeout);
      };
    }, [user?.id, loadRecommendedFriends, loadRecommendedRuns, loadHighlightsPreview])
  );

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!hasInitialLoadCompleted) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <Screen>
      <View style={[styles.pageBackground, { backgroundColor: colors.bg }]} pointerEvents="box-none">
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.homeHeaderWrapper, styles.homeHeader]} pointerEvents="box-none">
            <View style={styles.homeHeaderRow} pointerEvents="box-none">
              <View style={styles.homeHeaderSpacer} />
              <NotificationsAndInboxIcons />
            </View>
            <View style={styles.homeLogoAbsoluteCenter} pointerEvents="box-none">
              <PlayRatePlaceholder />
            </View>
          </View>

        {/* Section 1: Your Snapshot */}
        <View style={styles.section}>
          <SectionAccent tone="cyan" />
          <View style={styles.snapshotHeaderRow}>
            <Text style={[styles.snapshotTitle, { color: colors.text }]}>Your Snapshot</Text>
            <Text style={[styles.snapshotHelper, { color: colors.textMuted }]} numberOfLines={1}>tap to see full profile</Text>
          </View>
          <PlayRateSnapshotCard onPress={() => router.push('/(tabs)/profile' as any)} />
        </View>

        {/* Section 4b: Highlights preview (below Your Snapshot) */}
        <View style={styles.section}>
          <SectionAccent tone="pink" />
          <View style={styles.highlightsHeader}>
            <Text style={[styles.highlightsTitle, { color: colors.text }]}>Highlights</Text>
            <Pressable
              onPress={() => router.push('/highlights')}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityLabel="See all highlights"
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {(() => {
            if (loadingHighlights) {
              return (
                <View style={[styles.highlightsStrip, { marginTop: Spacing.sm }]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              );
            }
            if (highlightsLoadError) {
              return (
                <View style={[styles.sectionErrorWrap, { marginTop: Spacing.sm }]}>
                  <ErrorState onRetry={() => void loadHighlightsPreview()} />
                </View>
              );
            }
            if (highlightsPreview.length > 0) {
              return (
                <FlatList
                  horizontal
                  data={highlightsPreview}
                  keyExtractor={(item) => item.feed_item_key}
                  style={styles.highlightsFlatList}
                  contentContainerStyle={[styles.highlightsStrip, { paddingLeft: Spacing.lg, paddingRight: Spacing.lg }]}
                  showsHorizontalScrollIndicator={false}
                  renderItem={renderHighlightPreviewItem}
                />
              );
            }
            return (
              <CompactEmptyStateCard
                title="No highlights yet. Post one to show off your game!"
                subtitle="Share a clip from the court with the community."
                actionLabel="Create highlight"
                onAction={() => router.push('/highlights/create')}
              />
            );
          })()}
        </View>

        {/* Section 2: Recommended Runs */}
        <View style={styles.section}>
          <SectionAccent tone="pink" />
          <SectionTitle>Recommended Runs</SectionTitle>
          <Text style={[styles.recommendedRunsHelper, { color: colors.textMuted }]}>
            Top courts for your next run
          </Text>
          {loadingRuns ? (
            <View style={styles.loadingFriendsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : runsLoadError ? (
            <View style={styles.sectionErrorWrap}>
              <ErrorState onRetry={() => void loadRecommendedRuns()} />
            </View>
          ) : recommendedRuns.length > 0 ? (
            recommendedRuns.map((rec, index) => (
              <AnimatedListItem key={rec.id} index={index}>
                <RunListItem
                  courtName={rec.courtName}
                  distance={rec.distance}
                  startTime={rec.startTime === '—' ? undefined : rec.startTime}
                  spotsLeft={rec.spotsLeft === 0 ? undefined : rec.spotsLeft}
                  onPress={() => router.push(`/courts/${rec.id}` /* id is court_id → court detail */)}
                />
              </AnimatedListItem>
            ))
          ) : (
            <CompactEmptyStateCard
              title="No runs near you right now. Check back soon or find a court to start one!"
              subtitle="Follow a court or check in to get better run suggestions."
              actionLabel="Browse Courts"
              onAction={() => router.push('/courts')}
            />
          )}
        </View>

        {/* Section 4: Recommended Friends */}
        <View style={styles.section}>
          <SectionAccent tone="cyan" />
          <SectionTitle>Recommended Friends</SectionTitle>
          {loadingFriends ? (
            <View style={styles.loadingFriendsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : friendsLoadError ? (
            <View style={styles.sectionErrorWrap}>
              <ErrorState onRetry={() => void loadRecommendedFriends()} />
            </View>
          ) : recommendedFriends.length > 0 ? (
            recommendedFriends.map((friend) => (
              <RecommendedFriendItem
                key={friend.user_id}
                userId={friend.user_id}
                name={friend.name}
                username={friend.username}
                avatarUrl={friend.avatar_url}
                tierRepLevel={friend.rep_level}
                subtitle="Suggested"
                onPress={() => router.push(`/athletes/${friend.user_id}/profile` as any)}
              />
            ))
          ) : (
            <CompactEmptyStateCard
              title="No friend suggestions yet. Check in at courts to meet other players!"
              subtitle="Find athletes to follow and message."
              actionLabel="Find Athletes"
              onAction={() => router.push(ATHLETES_TAB_ROUTE as any)}
            />
          )}
        </View>

        {/* Section 5: Find Athletes */}
        <View style={styles.section}>
          <SectionAccent tone="cyan" />
          <SectionTitle>Find Athletes</SectionTitle>
          <AnimatedPressable
            onPress={() => router.push(ATHLETES_TAB_ROUTE as any)}
            style={styles.findAthletesCard}
          >
            <Card style={styles.findAthletesCardContent}>
              <View style={styles.findAthletesContent}>
                <View style={styles.findAthletesTextContainer}>
                  <Text style={[styles.findAthletesTitle, { color: colors.text }]}>Discover Players</Text>
                  <Text style={[styles.findAthletesSubtitle, { color: colors.textMuted }]}>
                    Browse athletes, check ratings, and connect with players
                  </Text>
                </View>
                <IconSymbol
                  name="person.3.fill"
                  size={32}
                  color={colors.primary}
                />
                <IconSymbol
                  name="chevron.right"
                  size={20}
                  color={colors.textMuted}
                  style={styles.chevron}
                />
              </View>
            </Card>
          </AnimatedPressable>
        </View>

        {/* Primary CTA */}
        <Button
          title="Find a Run"
          onPress={() => router.push('/courts')}
          variant="primary"
          style={styles.ctaButton}
        />
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
  },
  homeHeaderWrapper: {
    minHeight: 56,
    paddingTop: Spacing.sm,
    position: 'relative',
  },
  homeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  homeHeaderSpacer: {
    flex: 1,
  },
  homeLogoAbsoluteCenter: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeHeader: {
    marginBottom: Spacing.md,
  },
  snapshotHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: Spacing.md,
  },
  snapshotTitle: {
    ...Typography.h3,
  },
  snapshotHelper: {
    ...Typography.muted,
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  loadingFriendsContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  sectionErrorWrap: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  findAthletesCard: {
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
  findAthletesCardContent: {
    padding: 0,
    marginBottom: 0,
  },
  findAthletesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  findAthletesTextContainer: {
    flex: 1,
    marginRight: Spacing.md,
  },
  findAthletesTitle: {
    ...Typography.bodyBold,
    marginBottom: Spacing.xs,
  },
  findAthletesSubtitle: {
    ...Typography.muted,
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
  ctaButton: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  highlightsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  highlightsTitle: {
    ...Typography.bodyBold,
  },
  seeAll: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  highlightsFlatList: {
    minHeight: HOME_HIGHLIGHT_PREVIEW_TILE_PX + Spacing.sm * 2 + 22,
  },
  homeHighlightPreviewColumn: {
    marginRight: Spacing.sm,
    maxWidth: HOME_HIGHLIGHT_PREVIEW_TILE_PX + 12,
  },
  highlightsStrip: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  highlightTile: {
    width: HOME_HIGHLIGHT_PREVIEW_TILE_PX,
    height: HOME_HIGHLIGHT_PREVIEW_TILE_PX,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
  },
  highlightTileImage: {
    width: '100%',
    height: '100%',
  },
  highlightTilePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  highlightTilePlaceholderCaption: {
    ...Typography.mutedSmall,
    textAlign: 'center',
  },
  highlightTilePlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
  recommendedRunsHelper: {
    ...Typography.mutedSmall,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
