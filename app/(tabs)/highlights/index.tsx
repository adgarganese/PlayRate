/**
 * REINTRODUCTION STEP 3: Real Highlights screen restored. Athletes, Profile remain placeholders.
 * Stable baseline: Home + Courts + Highlights real; minimal tab shell; no haptics.
 */
import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Share,
  Alert,
  Dimensions,
  TextInput as RNTextInput,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyFeedIllustration } from '@/components/illustrations';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ProfilePicture } from '@/components/ProfilePicture';
import { HighlightPoster } from '@/components/HighlightPoster';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { SPORT_DEFINITIONS, getEnabledSportKeys } from '@/constants/sport-definitions';
import { loadHighlightsFeed, toggleHighlightLike, formatViewCount, type FeedHighlight } from '@/lib/highlights';
import { repostHighlight, undoRepost } from '@/lib/reposts';
import { logger } from '@/lib/logger';
import { UI_HIGHLIGHTS_LOAD_FAILED } from '@/lib/user-facing-errors';
import { resolveMediaUrlForPlayback } from '@/lib/storage-media-url';
import {
  useScrollContentBottomPadding,
  SCROLL_EXTRA_FOR_FLOATING_FAB,
} from '@/hooks/use-scroll-bottom-padding';
import { useTabBarSafeBottom } from '@/hooks/use-tab-bar-safe-bottom';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { SectionAccent } from '@/components/ui/SectionAccent';
import { DraftsList } from '@/components/DraftsList';
import { useDrafts } from '@/hooks/useDrafts';
import { HighlightFeedSkeleton } from '@/components/skeletons/HighlightFeedSkeleton';
import { TierBadge } from '@/components/ui/TierBadge';
import { hapticLight } from '@/lib/haptics';
import { playrateHighlightUrl } from '@/lib/deep-links';

const FEED_PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

function safeConfigureLayoutAnimation() {
  try {
    if (Platform.OS === 'android') {
      try {
        UIManager.setLayoutAnimationEnabledExperimental?.(true);
      } catch {
        /* */
      }
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch {
    /* LayoutAnimation can fail on some Android builds; UI still updates without animation */
  }
}

/** Feed media strip: stable across SE–Pro Max; clamp avoids extreme aspect ratios. */
const FEED_MEDIA_MIN_HEIGHT_PX = 264;
const FEED_MEDIA_MAX_HEIGHT_PX = 508;
const FEED_MEDIA_WIDTH_FACTOR = 1.05;
const FEED_MEDIA_VIEWPORT_HEIGHT_FACTOR = 0.36;

/** Feed clip: autoplay from muted; mute overlay matches detail. New `uri` remount (key) resets muted to true. Pause on tab blur; resume on focus. */
function FeedHighlightVideoPlayer({ uri, posterUri }: { uri: string; posterUri: string | null }) {
  const resolvedPosterUri = useResolvedMediaUri(posterUri);
  const [muted, setMuted] = useState(true);
  const [showPoster, setShowPoster] = useState(!!posterUri?.trim());
  useEffect(() => {
    setShowPoster(!!posterUri?.trim());
  }, [posterUri]);
  const player = useVideoPlayer({ uri }, (p) => {
    try {
      p.loop = true;
      p.muted = true;
      p.play();
    } catch {
      /* */
    }
  });

  useEffect(() => {
    try {
      player.loop = true;
      player.play();
    } catch {
      /* */
    }
  }, [player]);

  useEffect(() => {
    try {
      player.muted = muted;
    } catch {
      /* */
    }
  }, [muted, player]);

  useFocusEffect(
    useCallback(() => {
      try {
        player.loop = true;
        player.muted = muted;
        player.play();
      } catch {
        /* */
      }
      return () => {
        try {
          player.pause();
        } catch {
          /* NativeSharedObjectNotFoundException */
        }
      };
    }, [player, muted])
  );

  const toggleMute = () => {
    hapticLight();
    setMuted((m) => !m);
  };

  return (
    <View style={styles.feedVideo}>
      {resolvedPosterUri && showPoster ? (
        <Image
          source={{ uri: resolvedPosterUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      ) : null}
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls
        onFirstFrameRender={() => setShowPoster(false)}
      />
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.feedVideoMuteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}
      >
        <IconSymbol
          name={muted ? 'speaker.slash.fill' : 'speaker.wave.2.fill'}
          size={18}
          color="#fff"
        />
      </TouchableOpacity>
    </View>
  );
}

function computeFeedMediaHeightPx(): number {
  const { width: w, height: h } = Dimensions.get('window');
  return Math.round(
    Math.min(
      FEED_MEDIA_MAX_HEIGHT_PX,
      Math.max(FEED_MEDIA_MIN_HEIGHT_PX, w * FEED_MEDIA_WIDTH_FACTOR, h * FEED_MEDIA_VIEWPORT_HEIGHT_FACTOR)
    )
  );
}

type FeedListColors = {
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  accentPink: string;
  accentOrange: string;
};

const HighlightFeedListItem = memo(function HighlightFeedListItem({
  item,
  isVisibleVideo,
  resolvedVideoUrl,
  colors,
  mediaHeight,
  onOpen,
  onDm,
  onShare,
  onRepost,
  onLike,
  onComment,
  onLongPressCard,
}: {
  item: FeedHighlight;
  isVisibleVideo: boolean;
  resolvedVideoUrl: string | null;
  colors: FeedListColors;
  mediaHeight: number;
  onOpen: (id: string) => void;
  onDm: (id: string) => void;
  onShare: (item: FeedHighlight) => void;
  onRepost: (item: FeedHighlight) => void;
  onLike: (item: FeedHighlight) => void;
  onComment: (id: string) => void;
  onLongPressCard: (item: FeedHighlight) => void;
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={() => onOpen(item.id)}
        onLongPress={() => onLongPressCard(item)}
        delayLongPress={380}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <ProfilePicture avatarUrl={item.profile_avatar_url} size={36} editable={false} />
          <View style={styles.cardHeaderText}>
            <View style={styles.cardHeaderNameRow}>
              <AppText variant="bodyBold" color="text" numberOfLines={1} style={styles.cardHeaderName}>
                {item.profile_name || item.profile_username || 'User'}
              </AppText>
              <TierBadge tierName={item.profile_rep_level} size="sm" />
            </View>
            {item.sport ? (
              <AppText variant="mutedSmall" color="textMuted">{item.sport}</AppText>
            ) : null}
          </View>
        </View>
        <View style={[styles.feedMediaWrap, { height: mediaHeight }]}>
          {isVisibleVideo && resolvedVideoUrl ? (
            <FeedHighlightVideoPlayer
              key={resolvedVideoUrl}
              uri={resolvedVideoUrl}
              posterUri={item.thumbnail_url}
            />
          ) : (
            <HighlightPoster
              thumbnailUrl={item.thumbnail_url}
              mediaUrl={item.media_url}
              mediaType={item.media_type}
              caption={item.caption}
              fillContainer
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
          onPress={() => onLike(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel={item.is_liked ? 'Unlike' : 'Like'}
        >
          <IconSymbol name="heart.fill" size={14} color={item.is_liked ? colors.accentPink : colors.textMuted} />
          <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.like_count}</AppText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.statAction}
          onPress={() => onComment(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Comments"
        >
          <IconSymbol name="bubble.left.fill" size={14} color={colors.textMuted} style={styles.statIcon} />
          <AppText variant="mutedSmall" color="textMuted" style={styles.statText}>{item.comment_count ?? 0}</AppText>
        </TouchableOpacity>
        <AnimatedPressable
          style={styles.statAction}
          onPress={() => onRepost(item)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={item.has_reposted ? 'Undo repost' : 'Repost highlight'}
        >
          <IconSymbol
            name="arrow.2.squarepath"
            size={14}
            color={item.has_reposted ? colors.accentOrange : colors.textMuted}
          />
          <AppText
            variant="mutedSmall"
            color="textMuted"
            style={[styles.statText, item.has_reposted ? { color: colors.accentOrange } : undefined]}
          >
            {item.repost_count ?? 0}
          </AppText>
        </AnimatedPressable>
        <View style={styles.actionIcons}>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => onDm(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Send via DM"
          >
            <IconSymbol name="envelope.fill" size={18} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionIconBtn}
            onPress={() => onShare(item)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Share highlight"
          >
            <IconSymbol name="square.and.arrow.up" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
});

export default function HighlightsFeedScreen() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const fabBottom = useTabBarSafeBottom(Spacing.lg);
  const [highlights, setHighlights] = useState<FeedHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleFeedItemKey, setVisibleFeedItemKey] = useState<string | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string | null>(null);
  const [feedMediaHeight, setFeedMediaHeight] = useState(computeFeedMediaHeightPx);
  const { drafts: highlightDrafts, loading: draftsLoading, refresh: refreshDrafts } = useDrafts(
    user?.id ?? null
  );

  const [captionSearchInput, setCaptionSearchInput] = useState('');
  const [captionSearchDebounced, setCaptionSearchDebounced] = useState('');
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const [searchUiOpen, setSearchUiOpen] = useState(false);
  const captionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionSearchInputRef = useRef<RNTextInput>(null);

  const enabledSportKeys = useMemo(() => getEnabledSportKeys(), []);

  const dismissSearchUi = useCallback(() => {
    safeConfigureLayoutAnimation();
    setSearchUiOpen(false);
    setCaptionSearchInput('');
    setCaptionSearchDebounced('');
    setSelectedSport(null);
    if (captionDebounceRef.current) {
      clearTimeout(captionDebounceRef.current);
      captionDebounceRef.current = null;
    }
    captionSearchInputRef.current?.blur();
  }, []);

  const openSearchUi = useCallback(() => {
    safeConfigureLayoutAnimation();
    setSearchUiOpen(true);
    requestAnimationFrame(() => {
      captionSearchInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    if (captionDebounceRef.current) {
      clearTimeout(captionDebounceRef.current);
    }
    const trimmed = captionSearchInput.trim();
    if (!trimmed) {
      setCaptionSearchDebounced('');
      return;
    }
    captionDebounceRef.current = setTimeout(() => {
      setCaptionSearchDebounced(trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (captionDebounceRef.current) {
        clearTimeout(captionDebounceRef.current);
      }
    };
  }, [captionSearchInput]);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setFeedMediaHeight(computeFeedMediaHeightPx());
    });
    return () => sub.remove();
  }, []);

  const loadFeed = useCallback(async () => {
    if (__DEV__) {
      logger.info('[HighlightsFeed] fetch start');
    }
    setLoading(true);
    setError(null);
    try {
      const captionArg = captionSearchDebounced.trim() || undefined;
      const sportArg = selectedSport ?? undefined;
      const result = await loadHighlightsFeed(
        'all',
        user?.id ?? null,
        0,
        FEED_PAGE_SIZE,
        { captionSearch: captionArg, sport: sportArg }
      );
      if (__DEV__) {
        logger.info('[HighlightsFeed] fetch end', {
          count: result.highlights?.length ?? 0,
          hasError: !!result.error,
        });
      }
      if (result.error) {
        logger.error('[HighlightsFeed] feed returned error', { err: result.error, userId: user?.id ?? null });
        setError(result.error);
        setHighlights([]);
      } else {
        setHighlights(result.highlights ?? []);
      }
    } catch (err) {
      logger.error('[HighlightsFeed] fetch threw', { err, userId: user?.id ?? null });
      setError(UI_HIGHLIGHTS_LOAD_FAILED);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, captionSearchDebounced, selectedSport]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) return undefined;
      void loadFeed();
      if (user?.id) void refreshDrafts();
      return undefined;
    }, [authLoading, loadFeed, user?.id, refreshDrafts])
  );

  const handleRetry = () => {
    loadFeed();
  };

  const openHighlight = useCallback(
    (highlightId: string) => {
      router.push(`/highlights/${highlightId}`);
    },
    [router]
  );

  const openCreate = () => {
    router.push('/highlights/create');
  };

  const handleShare = useCallback(async (item: FeedHighlight) => {
    try {
      await Share.share({
        title: 'Highlight',
        message: `Check out this highlight. ${playrateHighlightUrl(item.id)}`,
      });
    } catch (error) {
      if (__DEV__) console.warn('[highlights:share]', error);
    }
  }, []);

  const patchHighlightRepost = useCallback((item: FeedHighlight, hasReposted: boolean, repostDelta: number) => {
    setHighlights((prev) =>
      prev.map((h) =>
        h.feed_item_key === item.feed_item_key
          ? {
              ...h,
              has_reposted: hasReposted,
              repost_count: Math.max(0, (h.repost_count ?? 0) + repostDelta),
            }
          : h
      )
    );
  }, []);

  const runRepostToggle = useCallback(
    async (item: FeedHighlight) => {
      if (!user?.id) {
        Alert.alert('Sign In Required', 'Sign in to repost highlights.');
        return;
      }
      hapticLight();
      const next = !item.has_reposted;
      patchHighlightRepost(item, next, next ? 1 : -1);
      try {
        if (next) {
          await repostHighlight(item.id, user.id);
        } else {
          await undoRepost(item.id, user.id);
        }
      } catch {
        patchHighlightRepost(item, !next, next ? -1 : 1);
        Alert.alert('Error', 'Could not update repost. Try again.');
      }
    },
    [user?.id, patchHighlightRepost]
  );

  const handleRepost = useCallback(
    (item: FeedHighlight) => {
      void runRepostToggle(item);
    },
    [runRepostToggle]
  );

  const handleLongPressRepost = useCallback(
    (item: FeedHighlight) => {
      if (!user?.id) {
        Alert.alert('Sign In Required', 'Sign in to repost highlights.');
        return;
      }
      if (item.has_reposted) {
        Alert.alert('Repost', 'Remove this repost from your profile?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Undo repost', style: 'destructive', onPress: () => void runRepostToggle(item) },
        ]);
      } else {
        Alert.alert('Repost', 'Repost this highlight to your profile?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Repost', onPress: () => void runRepostToggle(item) },
        ]);
      }
    },
    [user?.id, runRepostToggle]
  );

  const handleDm = useCallback(
    (highlightId: string) => {
      if (!user) {
        Alert.alert('Sign In Required', 'Sign in to send highlights via DM.');
        return;
      }
      router.push({ pathname: '/highlights/send-dm', params: { highlightId } });
    },
    [user, router]
  );

  const handleLikePress = useCallback(
    async (item: FeedHighlight) => {
      if (!user) return;
      hapticLight();
      const { success, newLikedState } = await toggleHighlightLike(item.id, user.id, item.is_liked);
      if (success) {
        setHighlights((prev) =>
          prev.map((h) =>
            h.feed_item_key === item.feed_item_key
              ? { ...h, is_liked: newLikedState, like_count: h.like_count + (newLikedState ? 1 : -1) }
              : h
          )
        );
      }
    },
    [user]
  );

  const handleCommentPress = useCallback((highlightId: string) => {
    router.push(`/highlights/${highlightId}/comments`);
  }, [router]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: { item: FeedHighlight; index: number | null }[] }) => {
    const first = viewableItems[0];
    const key = first?.item?.feed_item_key ?? null;
    setVisibleFeedItemKey((prev) => {
      if (prev === key) return prev;
      return key;
    });
  }).current;

  useEffect(() => {
    if (!visibleFeedItemKey || !highlights.length) {
      setResolvedVideoUrl(null);
      return;
    }
    const h = highlights.find((x) => x.feed_item_key === visibleFeedItemKey);
    if (!h || h.media_type !== 'video') {
      setResolvedVideoUrl(null);
      return;
    }
    setResolvedVideoUrl(null);
    let cancelled = false;
    resolveMediaUrlForPlayback(h.media_url)
      .then((url) => { if (!cancelled) setResolvedVideoUrl(url); })
      .catch(() => { if (!cancelled) setResolvedVideoUrl(null); });
    return () => { cancelled = true; };
  }, [visibleFeedItemKey, highlights]);

  const feedCardColors = useMemo(
    () => ({
      surface: colors.surface,
      border: colors.border,
      text: colors.text,
      textMuted: colors.textMuted,
      primary: colors.primary,
      accentPink: colors.accentPink,
      accentOrange: colors.accentOrange,
    }),
    [
      colors.surface,
      colors.border,
      colors.text,
      colors.textMuted,
      colors.primary,
      colors.accentPink,
      colors.accentOrange,
    ]
  );

  const renderFeedCard = useCallback(
    ({ item, index }: { item: FeedHighlight; index: number }) => (
      <AnimatedListItem index={index}>
        <View>
          {item.reposted_by_username ? (
            <Text
              style={[
                Typography.mutedSmall,
                { color: colors.textMuted, marginBottom: Spacing.xs, marginTop: index === 0 ? 0 : Spacing.xs },
              ]}
            >
              ↻ Reposted by {item.reposted_by_username}
            </Text>
          ) : null}
          <HighlightFeedListItem
            item={item}
            isVisibleVideo={
              item.feed_item_key === visibleFeedItemKey && item.media_type === 'video' && !!resolvedVideoUrl
            }
            resolvedVideoUrl={resolvedVideoUrl}
            colors={feedCardColors}
            mediaHeight={feedMediaHeight}
            onOpen={openHighlight}
            onDm={handleDm}
            onShare={handleShare}
            onRepost={handleRepost}
            onLike={handleLikePress}
            onComment={handleCommentPress}
            onLongPressCard={handleLongPressRepost}
          />
        </View>
      </AnimatedListItem>
    ),
    [
      visibleFeedItemKey,
      resolvedVideoUrl,
      feedCardColors,
      feedMediaHeight,
      colors.textMuted,
      openHighlight,
      handleDm,
      handleShare,
      handleRepost,
      handleLikePress,
      handleCommentPress,
      handleLongPressRepost,
    ]
  );

  const feedFilterActive = useMemo(
    () => Boolean(captionSearchDebounced.trim()) || selectedSport !== null,
    [captionSearchDebounced, selectedSport]
  );

  const headerSearchControl = (
    <TouchableOpacity
      onPress={() => (searchUiOpen ? dismissSearchUi() : openSearchUi())}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel={searchUiOpen ? 'Cancel search' : 'Search highlights'}
    >
      {searchUiOpen ? (
        <AppText variant="body" color="primary" style={styles.headerCancel}>
          Cancel
        </AppText>
      ) : (
        <IconSymbol name="magnifyingglass" size={24} color={colors.textMuted} />
      )}
    </TouchableOpacity>
  );

  if (authLoading) {
    return (
      <Screen>
        <Header title="Highlights" showBack={false} rightElement={headerSearchControl} />
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Highlights" showBack={false} rightElement={headerSearchControl} />
      {searchUiOpen ? (
        <View style={[styles.feedControlsWrap, { backgroundColor: colors.bg }]}>
          <View style={styles.searchContainer}>
            <RNTextInput
              ref={captionSearchInputRef}
              style={[
                styles.searchInput,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="Search highlights by caption..."
              placeholderTextColor={colors.textMuted}
              value={captionSearchInput}
              onChangeText={setCaptionSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Search highlights by caption"
              returnKeyType="search"
            />
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sportPillRow}
          >
            <TouchableOpacity
              onPress={() => setSelectedSport(null)}
              style={[
                styles.sportPill,
                {
                  borderColor: selectedSport === null ? colors.accentPink : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedSport === null }}
              accessibilityLabel="All sports"
            >
              <AppText variant="body" color="text" numberOfLines={1}>
                All sports
              </AppText>
            </TouchableOpacity>
            {enabledSportKeys.map((key) => {
              const name = SPORT_DEFINITIONS[key].name;
              const selected = selectedSport === name;
              return (
                <TouchableOpacity
                  key={key}
                  onPress={() => setSelectedSport(selected ? null : name)}
                  style={[
                    styles.sportPill,
                    {
                      borderColor: selected ? colors.accentPink : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Filter by ${name}`}
                >
                  <AppText variant="body" color="text" numberOfLines={1}>
                    {name}
                  </AppText>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}
      {loading && highlights.length === 0 ? (
        <HighlightFeedSkeleton />
      ) : error && highlights.length === 0 ? (
        <View style={[styles.center, styles.errorBlock, { flex: 1 }]}>
          <ErrorState onRetry={handleRetry} />
        </View>
      ) : (
        <>
        <FlatList
          data={highlights}
          keyExtractor={(item) => item.feed_item_key}
          contentContainerStyle={
            highlights.length === 0
              ? [styles.emptyList, { paddingBottom: scrollBottomPadding }]
              : [
                  styles.list,
                  {
                    paddingBottom: scrollBottomPadding + SCROLL_EXTRA_FOR_FLOATING_FAB,
                  },
                ]
          }
          renderItem={renderFeedCard}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 60 }}
          onViewableItemsChanged={onViewableItemsChanged}
          ListHeaderComponent={
            user && !draftsLoading && highlightDrafts.length > 0 ? (
              <View style={styles.draftsSection}>
                <SectionAccent tone="pink" />
                <Text style={[styles.draftsTitle, { color: colors.textMuted }]}>Drafts</Text>
                <DraftsList userId={user.id} drafts={highlightDrafts} onRefresh={refreshDrafts} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <EmptyState
              title={
                feedFilterActive
                  ? 'No highlights match your search or filters'
                  : 'No highlights yet. Be the first to post one!'
              }
              subtitle={
                feedFilterActive
                  ? 'Try different words or tap All sports to see the full feed.'
                  : "Share a clip from the court and show the community what you've got."
              }
              actionLabel={feedFilterActive ? undefined : 'Create highlight'}
              onAction={feedFilterActive ? undefined : openCreate}
              illustration={<EmptyFeedIllustration />}
            />
          }
        />
        <TouchableOpacity
          style={[
            styles.fab,
            {
              bottom: fabBottom,
              right: Spacing.lg,
              backgroundColor: colors.accentElectric,
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
  headerCancel: {
    fontWeight: '600',
    paddingVertical: 4,
  },
  feedControlsWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchContainer: {
    paddingBottom: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    minHeight: 44,
  },
  sportPillRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  sportPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
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
  list: {
    padding: Spacing.lg,
  },
  draftsSection: {
    marginBottom: Spacing.md,
  },
  draftsTitle: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  cardHeaderNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  cardHeaderName: {
    flexShrink: 1,
    minWidth: 0,
  },
  feedMediaWrap: {
    position: 'relative',
    width: '100%',
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  feedVideo: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  feedVideoMuteButton: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
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
