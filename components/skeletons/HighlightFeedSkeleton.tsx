import { View, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius } from '@/constants/theme';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

const FEED_MEDIA_MIN_HEIGHT_PX = 264;
const FEED_MEDIA_MAX_HEIGHT_PX = 508;
const FEED_MEDIA_WIDTH_FACTOR = 1.05;
const FEED_MEDIA_VIEWPORT_HEIGHT_FACTOR = 0.36;

function computeFeedMediaHeightPx(): number {
  const { width: w, height: h } = Dimensions.get('window');
  return Math.round(
    Math.min(
      FEED_MEDIA_MAX_HEIGHT_PX,
      Math.max(FEED_MEDIA_MIN_HEIGHT_PX, w * FEED_MEDIA_WIDTH_FACTOR, h * FEED_MEDIA_VIEWPORT_HEIGHT_FACTOR)
    )
  );
}

function FeedCardSkeleton({ mediaHeight }: { mediaHeight: number }) {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.cardHeader}>
        <SkeletonBlock width={36} height={36} borderRadius={18} />
        <View style={styles.cardHeaderText}>
          <SkeletonBlock width="55%" height={14} borderRadius={Radius.xs} />
          <SkeletonBlock width="35%" height={12} borderRadius={Radius.xs} style={styles.headerBar2} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={mediaHeight} borderRadius={0} />
      <View style={styles.captionArea}>
        <SkeletonBlock width="92%" height={14} borderRadius={Radius.xs} />
        <SkeletonBlock width="70%" height={14} borderRadius={Radius.xs} style={styles.captionLine2} />
      </View>
      <View style={styles.stats}>
        <SkeletonBlock width={14} height={14} borderRadius={7} />
        <SkeletonBlock width={28} height={12} borderRadius={Radius.xs} />
        <SkeletonBlock width={14} height={14} borderRadius={7} style={styles.statGap} />
        <SkeletonBlock width={24} height={12} borderRadius={Radius.xs} />
        <SkeletonBlock width={14} height={14} borderRadius={7} style={styles.statGap} />
        <SkeletonBlock width={20} height={12} borderRadius={Radius.xs} />
        <View style={styles.actionIcons}>
          <SkeletonBlock width={28} height={28} borderRadius={Radius.xs} />
          <SkeletonBlock width={28} height={28} borderRadius={Radius.xs} />
        </View>
      </View>
    </View>
  );
}

export function HighlightFeedSkeleton() {
  const mediaHeight = computeFeedMediaHeightPx();
  return (
    <SkeletonPlaceholder>
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {[0, 1, 2].map((i) => (
          <FeedCardSkeleton key={i} mediaHeight={mediaHeight} />
        ))}
      </ScrollView>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl + 64,
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
    gap: Spacing.xs,
  },
  headerBar2: {
    marginTop: Spacing.xs,
  },
  captionArea: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  captionLine2: {
    marginTop: 2,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    flexWrap: 'wrap',
    gap: 4,
  },
  statGap: {
    marginLeft: Spacing.xs,
  },
  actionIcons: {
    flexDirection: 'row',
    marginLeft: 'auto',
    gap: Spacing.sm,
  },
});
