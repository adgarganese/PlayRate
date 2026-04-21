import { useEffect, useState, useCallback, useRef, memo, useMemo } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import {
  useScrollContentBottomPadding,
  SCROLL_EXTRA_FOR_FLOATING_FAB,
} from '@/hooks/use-scroll-bottom-padding';
import { useTabBarSafeBottom } from '@/hooks/use-tab-bar-safe-bottom';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';
import { getRepostsByUser } from '@/lib/reposts';
import { logger } from '@/lib/logger';

const GRID_COLUMNS = 3;
const GRID_GAP = 2;
const PROFILE_GRID_PREVIEW_TRANSITION_MS = 160;
const HIGHLIGHT_VIDEO_GRID_FALLBACK_BG = '#0B0F1A';

type Highlight = {
  id: string;
  grid_key: string;
  sort_at: string;
  is_repost: boolean;
  user_id: string;
  sport: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  like_count: number;
};

const ProfileHighlightGridItem = memo(function ProfileHighlightGridItem({
  item,
  itemSize,
  surfaceAlt,
  surface,
  textMuted,
  isRepost,
  onPress,
}: {
  item: Highlight;
  itemSize: number;
  surfaceAlt: string;
  surface: string;
  textMuted: string;
  isRepost: boolean;
  onPress: () => void;
}) {
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
    <TouchableOpacity
      style={[styles.gridItem, { width: itemSize, height: itemSize, backgroundColor: surfaceAlt }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {displayUri ? (
        <Image
          source={{ uri: displayUri }}
          style={styles.thumbnail}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={PROFILE_GRID_PREVIEW_TRANSITION_MS}
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
            styles.placeholder,
            {
              backgroundColor:
                item.media_type === 'video' ? HIGHLIGHT_VIDEO_GRID_FALLBACK_BG : surface,
            },
          ]}
        >
          <IconSymbol
            name={item.media_type === 'video' ? 'play.rectangle.fill' : 'photo'}
            size={28}
            color={item.media_type === 'video' ? 'rgba(255,255,255,0.88)' : textMuted}
          />
          {item.caption ? (
            <Text
              numberOfLines={2}
              style={[
                styles.placeholderCaption,
                {
                  color: item.media_type === 'video' ? 'rgba(255,255,255,0.7)' : textMuted,
                },
              ]}
            >
              {item.caption}
            </Text>
          ) : null}
        </View>
      )}
      {item.media_type === 'video' && (
        <View style={styles.videoBadge}>
          <IconSymbol name="play.rectangle.fill" size={14} color="#fff" />
        </View>
      )}
      {isRepost ? (
        <View style={styles.repostOverlay}>
          <IconSymbol name="arrow.2.squarepath" size={11} color="#fff" />
        </View>
      ) : null}
    </TouchableOpacity>
  );
});

export default function MyHighlightsScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const fabBottom = useTabBarSafeBottom(Spacing.lg);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadHighlights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
      const repack = await getRepostsByUser(user.id, 100);
      const repostHighlightIds = [...new Set(repack.map((r) => r.highlight.id))];
      let repostLikeMap = new Map<string, number>();
      if (repostHighlightIds.length > 0) {
        const { data: rc } = await supabase
          .from('highlights_with_counts')
          .select('id, like_count')
          .in('id', repostHighlightIds);
        (rc || []).forEach((row: { id: string; like_count: number | null }) => {
          repostLikeMap.set(row.id, row.like_count ?? 0);
        });
      }

      const repostRows: Highlight[] = repack.map((r) => ({
        id: r.highlight.id,
        grid_key: `repost-${r.repost_id}`,
        sort_at: r.reposted_at,
        is_repost: true,
        user_id: r.highlight.user_id,
        sport: r.highlight.sport,
        media_type: r.highlight.media_type,
        media_url: r.highlight.media_url,
        thumbnail_url: r.highlight.thumbnail_url,
        caption: r.highlight.caption,
        created_at: r.highlight.created_at,
        like_count: repostLikeMap.get(r.highlight.id) ?? 0,
      }));

      const { data: viewData, error: viewError } = await supabase
        .from('highlights_with_counts')
        .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at, like_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      let owned: Highlight[] = [];

      if (viewError) {
        const { data, error } = await supabase
          .from('highlights')
          .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const ids = (data || []).map((h) => h.id);
        const likeCounts: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: likes } = await supabase
            .from('highlight_likes')
            .select('highlight_id')
            .in('highlight_id', ids);
          (likes || []).forEach((l: { highlight_id: string }) => {
            likeCounts[l.highlight_id] = (likeCounts[l.highlight_id] || 0) + 1;
          });
        }

        owned = (data || []).map((h) => ({
          ...h,
          grid_key: `own-${h.id}`,
          sort_at: h.created_at,
          is_repost: false,
          like_count: likeCounts[h.id] || 0,
        }));
      } else {
        owned = (viewData || []).map((h) => ({
          ...h,
          grid_key: `own-${h.id}`,
          sort_at: h.created_at,
          is_repost: false,
        }));
      }

      const merged = [...owned, ...repostRows].sort(
        (a, b) => new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime()
      );
      setHighlights(merged);
    } catch (err) {
      logger.error('[profile-highlights] load failed', { err, userId: user.id });
      setLoadError(true);
      setHighlights([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const t = setTimeout(() => router.replace('/sign-in'), 100);
      return () => clearTimeout(t);
    }
    loadHighlights();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const screenWidth = Dimensions.get('window').width;
  const itemSize = (screenWidth - Spacing.lg * 2 - GRID_GAP * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

  if (authLoading || !user) return null;

  return (
    <Screen>
      <Header
        title="My Highlights"
        showBack={false}
      />
      {loading ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading highlights...</Text>
        </View>
      ) : loadError ? (
        <View style={[styles.center, { flex: 1 }]}>
          <ErrorState onRetry={() => void loadHighlights()} />
        </View>
      ) : (
        <FlatList
          data={highlights}
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.grid_key}
          contentContainerStyle={[
            styles.grid,
            {
              paddingBottom: scrollBottomPadding + SCROLL_EXTRA_FOR_FLOATING_FAB,
            },
          ]}
          columnWrapperStyle={styles.row}
          renderItem={({ item }) => (
            <ProfileHighlightGridItem
              item={item}
              itemSize={itemSize}
              surfaceAlt={colors.surfaceAlt}
              surface={colors.surface}
              textMuted={colors.textMuted}
              isRepost={item.is_repost}
              onPress={() => router.push(`/profile/highlights/${item.id}` as any)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="You haven't posted any highlights yet"
              subtitle="Record a play, add a caption, and share it with the community."
              actionLabel="Create highlight"
              onAction={() => router.push('/highlights/create' as any)}
            />
          }
        />
      )}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            bottom: fabBottom,
            right: Spacing.lg,
            backgroundColor: colors.accentElectric,
          },
        ]}
        onPress={() => router.push('/highlights/create' as any)}
        activeOpacity={0.8}
        accessibilityLabel="Create highlight"
        accessibilityRole="button"
      >
        <IconSymbol name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center', gap: Spacing.lg },
  loadingText: { ...Typography.body },
  grid: { padding: Spacing.lg },
  row: { gap: GRID_GAP, marginBottom: GRID_GAP },
  gridItem: { borderRadius: Radius.xs, overflow: 'hidden' },
  thumbnail: { width: '100%', height: '100%' },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    gap: Spacing.xs,
  },
  placeholderCaption: {
    ...Typography.mutedSmall,
    textAlign: 'center',
  },
  videoBadge: { position: 'absolute', bottom: 4, right: 4 },
  repostOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
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
