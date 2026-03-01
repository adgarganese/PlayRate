import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, ActivityIndicator, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/auth-context';
import { loadHighlightsFeed, type FeedHighlight } from '@/lib/highlights';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { PlayRateSnapshotCard } from '@/components/PlayRateSnapshotCard';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { MessageButton } from '@/components/MessageButton';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { useFollow } from '@/hooks/useFollow';

const HIGHLIGHT_TILE_SIZE = 100;
const HIGHLIGHTS_PREVIEW_LIMIT = 4;

export default function AthletePublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { colors } = useThemeColors();
  const { isFollowing, toggleFollow, toggleLoading } = useFollow(userId ?? null);
  const [highlightsPreview, setHighlightsPreview] = useState<FeedHighlight[]>([]);
  const [loadingHighlights, setLoadingHighlights] = useState(false);

  const loadHighlights = useCallback(async () => {
    if (!userId || !user) return;
    setLoadingHighlights(true);
    try {
      const result = await loadHighlightsFeed(
        'friends_local',
        user.id,
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
    if (userId && user) {
      loadHighlights();
    }
  }, [userId, user?.id, loadHighlights]);

  if (authLoading) return <LoadingScreen message="Loading..." />;
  if (!user) return <Redirect href="/sign-in" />;
  if (!userId) return <LoadingScreen message="Invalid profile" />;

  const isOwnProfile = user.id === userId;

  return (
    <Screen>
      <Header title="Profile" showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
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
          ) : (
            <View style={[styles.highlightsEmpty, { borderColor: colors.border }]}>
              <Text style={[styles.highlightsEmptyText, { color: colors.textMuted }]}>No highlights yet.</Text>
            </View>
          )}
        </View>

        {/* Rate this player CTA */}
        {!isOwnProfile && (
          <View style={styles.rateSection}>
            <ProfileNavPill
              icon="star.fill"
              label="Rate this player"
              onPress={() => router.push(`/athletes/${userId}` as any)}
              showChevron={false}
              style={styles.ratePill}
            />
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xxl,
  },
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
  rateSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  ratePill: {
    width: '100%',
  },
  pressed: {
    opacity: 0.7,
  },
});
