import { useEffect, useState, useCallback, useRef } from 'react';
import { StyleSheet, ScrollView, View, Text, Pressable, ActivityIndicator, FlatList, TouchableOpacity } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { fetchRecommendedRuns, type RecommendedCourtItem } from '@/lib/courts';
import { loadHighlightsFeed, type FeedHighlight } from '@/lib/highlights';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { SectionTitle } from '@/components/SectionTitle';
import { PlayRateSnapshotCard } from '@/components/PlayRateSnapshotCard';
import { RunListItem } from '@/components/RunListItem';
import { RecommendedFriendItem } from '@/components/RecommendedFriendItem';
import { Card } from '@/components/Card';
import { CompactEmptyStateCard } from '@/components/ui/CompactEmptyStateCard';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PlayRatePlaceholder } from '@/components/PlayRatePlaceholder';
import { NotificationsAndInboxIcons } from '@/components/NotificationsAndInboxIcons';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { track, trackOnce } from '@/lib/analytics';
import { logDevError } from '@/lib/dev-log';
import { ATHLETES_TAB_ROUTE } from '@/constants/routes';

const HIGHLIGHTS_PREVIEW_LIMIT = 6;
const HIGHLIGHT_TILE_SIZE = 100;

type RecommendedFriend = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

export default function HomeScreen() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const [recommendedFriends, setRecommendedFriends] = useState<RecommendedFriend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [recommendedRuns, setRecommendedRuns] = useState<RecommendedCourtItem[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(false);
  const [highlightsPreview, setHighlightsPreview] = useState<FeedHighlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const homeViewedFired = useRef(false);
  const runRecommendationsViewedFired = useRef(false);
  const [hasInitialLoadCompleted, setHasInitialLoadCompleted] = useState(false);

  const loadRecommendedRuns = useCallback(async () => {
    setLoadingRuns(true);
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
    try {
      // Get list of users the current user already follows
      const { data: followingData } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id);

      const followingIds = (followingData || []).map((f) => f.following_id);
      // Always exclude current user
      const excludeIds = [user.id, ...followingIds];

      // Fetch profiles excluding current user and already-followed users
      // Order by newest users (created_at desc)
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('user_id, name, username, avatar_url, created_at')
        .not('user_id', 'in', `(${excludeIds.join(',')})`)
        .order('created_at', { ascending: false })
        .limit(15);

      if (error) {
        logDevError('home:loadRecommendedFriends', error);
        setRecommendedFriends([]);
        return;
      }

      setRecommendedFriends(profiles || []);
    } catch (err) {
      logDevError('home:loadRecommendedFriends', err);
      setRecommendedFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [user]);

  const loadHighlightsPreview = useCallback(async () => {
    setLoadingHighlights(true);
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
        setHighlightsPreview([]);
      }
    } catch (error) {
      logDevError('home:loadHighlightsPreview', error);
      setHighlightsPreview([]);
    } finally {
      setLoadingHighlights(false);
    }
  }, [user?.id]);

  // Analytics: home_viewed once per mount when user is present
  useEffect(() => {
    if (user && !homeViewedFired.current) {
      homeViewedFired.current = true;
      trackOnce('home_viewed', 'mount');
    }
  }, [user]);

  // Analytics: run_recommendations_viewed once after Next Best Runs load completes
  // Analytics: run_recommendations_viewed once after Recommended Runs load completes
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

  // Single-wave initial load: run all three in parallel, then mark initial load done
  useEffect(() => {
    if (!user) {
      setHasInitialLoadCompleted(false);
      return;
    }
    setHasInitialLoadCompleted(false);
    let done = 0;
    const checkAllDone = () => {
      done += 1;
      if (done >= 3) setHasInitialLoadCompleted(true);
    };
    loadRecommendedFriends().then(checkAllDone);
    loadRecommendedRuns().then(checkAllDone);
    loadHighlightsPreview().then(checkAllDone);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Refresh on screen focus
  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadRecommendedFriends();
        loadRecommendedRuns();
        loadHighlightsPreview();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id])
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
      <View style={[styles.pageBackground, { backgroundColor: colors.bg }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Header
            title="PlayRate"
            customTitle={
              <View style={styles.homeLogoTopCenter}>
                <PlayRatePlaceholder />
              </View>
            }
            showBack={false}
            rightElement={<NotificationsAndInboxIcons />}
            style={styles.homeHeader}
          />

        {/* Section 1: Your Snapshot */}
        <View style={styles.section}>
          <View style={styles.snapshotHeaderRow}>
            <Text style={[styles.snapshotTitle, { color: colors.text }]}>Your Snapshot</Text>
            <Text style={[styles.snapshotHelper, { color: colors.textMuted }]} numberOfLines={1}>tap to see full profile</Text>
          </View>
          <PlayRateSnapshotCard onPress={() => router.push('/(tabs)/profile' as any)} />
        </View>

        {/* Section 2: Recommended Runs */}
        <View style={styles.section}>
          <SectionTitle>Recommended Runs</SectionTitle>
          <Text style={[styles.recommendedRunsHelper, { color: colors.textMuted }]}>
            Top courts for your next run
          </Text>
          {loadingRuns ? (
            <View style={styles.loadingFriendsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recommendedRuns.length > 0 ? (
            (() => {
              if (__DEV__) {
                console.log('[Home] Recommended Runs count', recommendedRuns.length, recommendedRuns.slice(0, 5).map((r) => r.id));
              }
              return recommendedRuns.map((rec) => (
                <RunListItem
                  key={rec.id}
                  courtName={rec.courtName}
                  distance={rec.distance}
                  startTime={rec.startTime === '—' ? undefined : rec.startTime}
                  spotsLeft={rec.spotsLeft === 0 ? undefined : rec.spotsLeft}
                  onPress={() => router.push(`/courts/${rec.id}` /* id is court_id → court detail */)}
                />
              ));
            })()
          ) : (
            <CompactEmptyStateCard
              title="No recommended runs right now."
              subtitle="Follow a court or check in to get better run suggestions."
              actionLabel="Browse Courts"
              onAction={() => router.push('/courts')}
            />
          )}
        </View>

        {/* Section 4: Recommended Friends */}
        <View style={styles.section}>
          <SectionTitle>Recommended Friends</SectionTitle>
          {loadingFriends ? (
            <View style={styles.loadingFriendsContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : recommendedFriends.length > 0 ? (
            recommendedFriends.map((friend) => (
              <RecommendedFriendItem
                key={friend.user_id}
                userId={friend.user_id}
                name={friend.name}
                username={friend.username}
                avatarUrl={friend.avatar_url}
                subtitle="Suggested"
                onPress={() => router.push(`/athletes/${friend.user_id}/profile` as any)}
              />
            ))
          ) : (
            <CompactEmptyStateCard
              title="No recommendations right now."
              subtitle="Find athletes to follow and message."
              actionLabel="Find Athletes"
              onAction={() => router.push(ATHLETES_TAB_ROUTE as any)}
            />
          )}
        </View>

        {/* Section 4b: Highlights preview */}
        <View style={styles.section}>
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
            if (highlightsPreview.length > 0) {
              return (
                <FlatList
                  horizontal
                  data={highlightsPreview}
                  keyExtractor={(item) => item.id}
                  style={styles.highlightsFlatList}
                  contentContainerStyle={[styles.highlightsStrip, { paddingLeft: Spacing.lg, paddingRight: Spacing.lg }]}
                  showsHorizontalScrollIndicator={false}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[styles.highlightTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
                      onPress={() => router.push(`/highlights/${item.id}` as any)}
                      activeOpacity={0.8}
                    >
                      {(item.thumbnail_url || item.media_url) ? (
                        <Image
                          source={{ uri: item.thumbnail_url || item.media_url }}
                          style={styles.highlightTileImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.highlightTilePlaceholder, { backgroundColor: colors.surface }]}>
                          <IconSymbol name="play.rectangle.fill" size={28} color={colors.textMuted} />
                        </View>
                      )}
                      {item.media_type === 'video' ? (
                        <View style={styles.highlightTilePlayBadge}>
                          <IconSymbol name="play.fill" size={10} color="#fff" />
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  )}
                />
              );
            }
            return (
              <View style={[styles.highlightsEmpty, { borderColor: colors.border }]}>
                <Text style={[styles.highlightsEmptyText, { color: colors.textMuted }]}>No highlights yet.</Text>
                <Pressable onPress={() => router.push('/highlights/create')} style={({ pressed }) => (pressed ? styles.pressed : undefined)}>
                  <Text style={[styles.highlightsEmptyAction, { color: colors.primary }]}>Create</Text>
                </Pressable>
              </View>
            );
          })()}
        </View>

        {/* Section 5: Find Athletes */}
        <View style={styles.section}>
          <SectionTitle>Find Athletes</SectionTitle>
          <Pressable
            onPress={() => router.push(ATHLETES_TAB_ROUTE as any)}
            style={({ pressed }) => [
              styles.findAthletesCard,
              pressed && styles.pressed,
            ]}
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
          </Pressable>
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
  homeLogoTopCenter: {
    width: '100%',
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
  /** Matches Court Details "tap chat to type" helper (Typography.muted, marginLeft) */
  snapshotHelper: {
    ...Typography.muted,
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
  scrollContent: {
    paddingBottom: 100, // Space for tab bar
  },
  section: {
    marginBottom: Spacing.xl,
  },
  loadingFriendsContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
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
    height: HIGHLIGHT_TILE_SIZE + Spacing.sm * 2,
  },
  highlightsStrip: {
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  highlightTile: {
    width: HIGHLIGHT_TILE_SIZE,
    height: HIGHLIGHT_TILE_SIZE,
    borderRadius: Radius.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginRight: Spacing.sm,
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
  },
  highlightTilePlayBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
  highlightsEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginHorizontal: Spacing.lg,
  },
  highlightsEmptyText: {
    ...Typography.mutedSmall,
  },
  highlightsEmptyAction: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  recommendedRunsHelper: {
    ...Typography.mutedSmall,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
