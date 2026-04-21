import { useEffect, useState, useCallback, memo, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import { loadHighlightsFeed, type FeedHighlight } from '@/lib/highlights';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { SectionAccent } from '@/components/ui/SectionAccent';
import { ActivityHistoryCard } from '@/components/ActivityHistoryCard';
import { PlayRateSnapshotCard } from '@/components/PlayRateSnapshotCard';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { MessageButton } from '@/components/MessageButton';
import { RatePlayerCTA } from '@/components/RatePlayerCTA';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { useFollow } from '@/hooks/useFollow';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

const HIGHLIGHT_TILE_SIZE = 100;
const HIGHLIGHTS_PREVIEW_LIMIT = 4;
const STRIP_VIDEO_FALLBACK_BG = '#0B0F1A';

const AthleteHighlightStripTile = memo(function AthleteHighlightStripTile({
  item,
  onPress,
  surface,
}: {
  item: FeedHighlight;
  onPress: () => void;
  surface: string;
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
  }, [item.feed_item_key, item.thumbnail_url, item.media_url, item.media_type]);

  const raw = useMemo(() => {
    if (imageFailed) return null;
    return pickHighlightStillImageRaw(item.thumbnail_url, item.media_url, item.media_type);
  }, [item.thumbnail_url, item.media_url, item.media_type, imageFailed]);

  const displayUri = useResolvedMediaUri(raw);
  const isVideo = item.media_type === 'video';

  return (
    <TouchableOpacity
      style={[styles.highlightTile, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {displayUri ? (
        <Image
          source={{ uri: displayUri }}
          style={styles.highlightTileImage}
          contentFit="cover"
          cachePolicy="memory-disk"
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
            { backgroundColor: isVideo ? STRIP_VIDEO_FALLBACK_BG : surface },
          ]}
        >
          <IconSymbol
            name={isVideo ? 'play.rectangle.fill' : 'photo'}
            size={28}
            color={isVideo ? 'rgba(255,255,255,0.88)' : colors.textMuted}
          />
          {isVideo && item.caption?.trim() ? (
            <Text numberOfLines={2} style={styles.highlightTileCaption}>
              {item.caption.trim()}
            </Text>
          ) : null}
        </View>
      )}
      {isVideo ? (
        <View style={styles.highlightTilePlayBadge}>
          <IconSymbol name="play.fill" size={10} color="#fff" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export default function AthletePublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const { isFollowing, toggleFollow, toggleLoading } = useFollow(userId ?? null);
  const [highlightsPreview, setHighlightsPreview] = useState<FeedHighlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);
  const [rateCtaMeta, setRateCtaMeta] = useState<{
    loaded: boolean;
    hasRated: boolean;
    playerName: string | null;
  }>({ loaded: false, hasRated: false, playerName: null });

  const loadHighlights = useCallback(async () => {
    const viewerId = user?.id;
    if (!userId || !viewerId) return;
    setLoadingHighlights(true);
    try {
      const result = await loadHighlightsFeed(
        'friends_local',
        viewerId,
        0,
        HIGHLIGHTS_PREVIEW_LIMIT,
        { followingIds: [userId] }
      );
      setHighlightsPreview(result.highlights ?? []);
    } catch (error) {
      if (__DEV__) console.warn('[athlete-profile:highlightsPreview]', error);
      setHighlightsPreview([]);
    } finally {
      setLoadingHighlights(false);
    }
  }, [userId, user?.id]);

  useEffect(() => {
    if (userId && user?.id) {
      loadHighlights();
    }
  }, [userId, user?.id, loadHighlights]);

  useFocusEffect(
    useCallback(() => {
      if (!userId || !user?.id || user.id === userId) {
        setRateCtaMeta({ loaded: true, hasRated: false, playerName: null });
        return undefined;
      }
      let cancelled = false;
      void (async () => {
        const [profileRes, cosignRes] = await Promise.all([
          supabase.from('profiles').select('name, username').eq('user_id', userId).maybeSingle(),
          supabase
            .from('cosigns')
            .select('id')
            .eq('from_user_id', user.id)
            .eq('to_user_id', userId)
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        const row = profileRes.data;
        const nm = row?.name?.trim() || row?.username?.trim() || null;
        setRateCtaMeta({
          loaded: true,
          hasRated: !!cosignRes.data,
          playerName: nm,
        });
      })();
      return () => {
        cancelled = true;
      };
    }, [userId, user?.id])
  );

  if (authLoading) return <LoadingScreen message="Loading..." />;
  if (!user) return <Redirect href="/sign-in" />;
  if (!userId) return <LoadingScreen message="Invalid profile" />;

  const isOwnProfile = user.id === userId;

  return (
    <Screen>
      <Header title="Profile" showBack />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Snapshot Card */}
        <View style={[styles.section, { marginHorizontal: Spacing.lg }]}>
          <PlayRateSnapshotCard targetUserId={userId} />
        </View>

        {/* Action pills: Follow, Message (not shown for own profile) */}
        {!isOwnProfile && (
          <View style={styles.pillsRow}>
            <ProfileNavPill
              icon={isFollowing ? 'person.fill.checkmark' : 'person.badge.plus'}
              label={isFollowing ? 'Following' : 'Follow'}
              onPress={toggleFollow}
              loading={toggleLoading}
              disabled={toggleLoading}
              showChevron={false}
              active={isFollowing}
              style={styles.pill}
            />
            <MessageButton
              targetUserId={userId}
              pill
              style={styles.pill}
            />
          </View>
        )}

        {!isOwnProfile && rateCtaMeta.loaded && (
          <View style={[styles.rateCtaSection, { marginHorizontal: Spacing.lg }]}>
            <SectionAccent tone="cyan" />
            <RatePlayerCTA
              hasRated={rateCtaMeta.hasRated}
              playerName={rateCtaMeta.playerName ?? undefined}
              onPress={() => router.push(`/athletes/${userId}` as any)}
            />
          </View>
        )}

        {/* Highlights preview strip */}
        <View style={styles.section}>
          <View style={styles.highlightsHeader}>
            <Text style={[styles.highlightsTitle, { color: colors.text }]}>Highlights</Text>
            <Pressable
              onPress={() => router.push(`/athletes/${userId}/highlights` as any)}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityLabel="See all highlights"
            >
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </Pressable>
          </View>
          {loadingHighlights ? (
            <View style={[styles.highlightsStrip, { marginTop: Spacing.sm }]}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : highlightsPreview.length > 0 ? (
            <FlatList
              horizontal
              data={highlightsPreview}
              keyExtractor={(item) => item.feed_item_key}
              style={styles.highlightsFlatList}
              contentContainerStyle={[styles.highlightsStrip, { paddingLeft: Spacing.lg, paddingRight: Spacing.lg }]}
              showsHorizontalScrollIndicator={false}
              renderItem={({ item }) => (
                <AthleteHighlightStripTile
                  item={item}
                  surface={colors.surface}
                  onPress={() => router.push(`/highlights/${item.id}`)}
                />
              )}
            />
          ) : (
            <View style={[styles.highlightsEmpty, { borderColor: colors.border }]}>
              <Text style={[styles.highlightsEmptyText, { color: colors.textMuted }]}>No highlights yet.</Text>
            </View>
          )}
        </View>

        <View style={[styles.section, { marginHorizontal: Spacing.lg }]}>
          <Card>
            <SectionAccent tone="pink" />
            <ActivityHistoryCard userId={userId} />
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {},
  section: {
    marginBottom: Spacing.xl,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  pill: {
    flex: 1,
    minWidth: 100,
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
    paddingHorizontal: Spacing.xs,
  },
  highlightTileCaption: {
    marginTop: Spacing.xs,
    fontSize: 10,
    lineHeight: 13,
    color: 'rgba(255,255,255,0.72)',
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
  highlightsEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginHorizontal: Spacing.lg,
  },
  highlightsEmptyText: {
    ...Typography.mutedSmall,
  },
  rateCtaSection: {
    marginBottom: Spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
});
