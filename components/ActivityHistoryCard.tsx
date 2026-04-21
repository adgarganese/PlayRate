import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { EmptyState } from '@/components/ui/EmptyState';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { useActivityHistory } from '@/hooks/useActivityHistory';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import type { ActivityItem, ActivityType } from '@/lib/activity-history';
import { formatShortRelativeTime } from '@/lib/format-relative-time';

const TAB_LABELS = ['Likes', 'Comments', 'Reposts'] as const;
const TAB_TYPES: ActivityType[] = ['like', 'comment', 'repost'];
const THUMB_SIZE = 40;

function displayCreatorName(username: string | null): string {
  const t = username?.trim();
  return t && t.length > 0 ? t : 'someone';
}

function ActivityRowThumbnail({ item }: { item: ActivityItem }) {
  const { colors } = useThemeColors();
  const thumb = item.highlight_thumbnail_url?.trim() || null;
  const imageFallback =
    item.highlight_media_type === 'image' && item.highlight_media_url?.trim()
      ? item.highlight_media_url.trim()
      : null;
  const uri = useResolvedMediaUri(thumb || imageFallback);
  const isVideo = item.highlight_media_type === 'video';

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={styles.thumbnail}
        contentFit="cover"
        cachePolicy="memory-disk"
      />
    );
  }

  return (
    <View
      style={[
        styles.thumbnail,
        styles.thumbPlaceholder,
        {
          backgroundColor: isVideo ? '#0B0F1A' : colors.surfaceAlt,
          borderColor: colors.border,
        },
      ]}
    >
      <IconSymbol
        name={isVideo ? 'play.rectangle.fill' : 'photo'}
        size={22}
        color={isVideo ? 'rgba(255,255,255,0.85)' : colors.textMuted}
      />
    </View>
  );
}

function ActivityHistoryRow({
  item,
  index,
  onPress,
}: {
  item: ActivityItem;
  index: number;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  const creator = displayCreatorName(item.highlight_creator_username);
  const time = formatShortRelativeTime(item.created_at);

  let primaryLine: string;
  let secondaryLine: string | null = null;

  switch (item.type) {
    case 'like':
      primaryLine = `Liked ${creator}'s highlight`;
      break;
    case 'comment':
      primaryLine = item.comment_text?.trim() || '…';
      secondaryLine = `on ${creator}'s highlight`;
      break;
    case 'repost':
      primaryLine = `Reposted ${creator}'s highlight`;
      break;
    default:
      primaryLine = '';
  }

  return (
    <AnimatedListItem index={index}>
      <AnimatedPressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { borderBottomColor: colors.border },
          pressed && styles.rowPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Open highlight: ${primaryLine}`}
      >
        <ActivityRowThumbnail item={item} />
        <View style={styles.rowText}>
          {item.type === 'comment' ? (
            <>
              <Text
                style={[styles.bodyText, { color: colors.text }]}
                numberOfLines={2}
              >
                {primaryLine}
              </Text>
              {secondaryLine ? (
                <Text
                  style={[styles.mutedLine, { color: colors.textMuted }]}
                  numberOfLines={1}
                >
                  {secondaryLine}
                </Text>
              ) : null}
              <Text
                style={[styles.timeText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {time}
              </Text>
            </>
          ) : (
            <>
              <Text
                style={[styles.bodyText, { color: colors.text }]}
                numberOfLines={2}
              >
                {primaryLine}
              </Text>
              <Text
                style={[styles.timeText, { color: colors.textMuted }]}
                numberOfLines={1}
              >
                {time}
              </Text>
            </>
          )}
        </View>
      </AnimatedPressable>
    </AnimatedListItem>
  );
}

type ActivityHistoryCardProps = {
  userId: string;
};

export function ActivityHistoryCard({ userId }: ActivityHistoryCardProps) {
  const { colors } = useThemeColors();
  const router = useRouter();
  const [tabIndex, setTabIndex] = useState(0);
  const activeTab = TAB_TYPES[tabIndex] ?? 'like';

  const { items, loading, error, loadMore, hasMore } = useActivityHistory(
    userId,
    activeTab
  );

  const emptyConfig = useMemo(() => {
    switch (activeTab) {
      case 'like':
        return { title: 'No likes yet', icon: 'heart.fill' as const };
      case 'comment':
        return { title: 'No comments yet', icon: 'message.fill' as const };
      case 'repost':
        return {
          title: 'No reposts yet',
          icon: 'arrow.2.squarepath' as const,
        };
      default:
        return { title: 'Nothing here', icon: 'play.rectangle.fill' as const };
    }
  }, [activeTab]);

  const onPressHighlight = useCallback(
    (highlightId: string) => {
      router.push(`/highlights/${highlightId}`);
    },
    [router]
  );

  const listEmpty = useMemo(() => {
    if (loading && items.length === 0) {
      return (
        <View style={styles.emptyLoading}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.emptyLoading}>
          <Text style={[Typography.mutedSmall, { color: colors.textMuted }]}>
            {error}
          </Text>
        </View>
      );
    }
    return (
      <EmptyState title={emptyConfig.title} icon={emptyConfig.icon} />
    );
  }, [loading, items.length, error, emptyConfig, colors.primary, colors.textMuted]);

  const listFooter = useMemo(() => {
    if (!loading || items.length === 0) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [loading, items.length, colors.primary]);

  return (
    <View>
      <Text style={[styles.cardTitle, { color: colors.textMuted }]}>Activity</Text>
      <SegmentedControl
        options={[...TAB_LABELS]}
        selectedIndex={tabIndex}
        onSelect={setTabIndex}
      />
      <View style={[styles.listShell, { borderColor: colors.border }]}>
        {items.length === 0 ? (
          <View style={styles.listContentEmpty}>{listEmpty}</View>
        ) : (
          <View style={styles.listContent}>
            {items.map((item, index) => (
              <ActivityHistoryRow
                key={item.id}
                item={item}
                index={index}
                onPress={() => onPressHighlight(item.highlight_id)}
              />
            ))}
            {listFooter}
            {hasMore && !loading ? (
              <Pressable
                onPress={() => loadMore()}
                style={({ pressed }) => [styles.loadMoreRow, pressed && styles.loadMoreRowPressed]}
                accessibilityRole="button"
                accessibilityLabel="Load more activity"
              >
                <Text style={[Typography.body, { color: colors.primary }]}>Load more</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardTitle: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listShell: {
    borderWidth: 1,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  listContent: {
    paddingVertical: Spacing.xs,
  },
  listContentEmpty: {
    minHeight: 200,
    justifyContent: 'center',
  },
  loadMoreRow: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  loadMoreRowPressed: {
    opacity: 0.7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  rowPressed: {
    opacity: 0.85,
  },
  thumbnail: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  thumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  bodyText: {
    ...Typography.body,
  },
  mutedLine: {
    ...Typography.muted,
    marginTop: 2,
  },
  timeText: {
    ...Typography.mutedSmall,
    marginTop: Spacing.xs,
  },
  emptyLoading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
});
