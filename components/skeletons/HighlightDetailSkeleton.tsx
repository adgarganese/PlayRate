import { View, StyleSheet, Dimensions } from 'react-native';
import { Spacing, Radius } from '@/constants/theme';
import { Card } from '@/components/Card';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

const DETAIL_CARD_SCREEN_MARGIN = Spacing.md;
const DETAIL_MEDIA_HEIGHT_PER_WIDTH = 1.1;
const DETAIL_MEDIA_MAX_VIEWPORT_RATIO = 0.5;

function computeDetailMediaLayout(): { bleedWidth: number; mediaHeight: number } {
  const { width: sw, height: sh } = Dimensions.get('window');
  const bleedWidth = Math.round(sw - DETAIL_CARD_SCREEN_MARGIN * 2);
  const mediaHeight = Math.round(
    Math.min(bleedWidth * DETAIL_MEDIA_HEIGHT_PER_WIDTH, sh * DETAIL_MEDIA_MAX_VIEWPORT_RATIO)
  );
  return { bleedWidth, mediaHeight };
}

export function HighlightDetailSkeleton() {
  const { bleedWidth, mediaHeight } = computeDetailMediaLayout();
  return (
    <SkeletonPlaceholder>
      <View style={styles.root}>
        <Card style={styles.card}>
          <View style={styles.profileRow}>
            <SkeletonBlock width={40} height={40} borderRadius={20} />
            <View style={styles.profileText}>
              <SkeletonBlock width={140} height={16} borderRadius={Radius.xs} />
              <SkeletonBlock width={100} height={12} borderRadius={Radius.xs} style={styles.profileBar2} />
            </View>
          </View>
          <View
            style={[
              styles.mediaContainer,
              {
                width: bleedWidth,
                height: mediaHeight,
                marginHorizontal: -Spacing.lg,
              },
            ]}
          >
            <SkeletonBlock width="100%" height={mediaHeight} borderRadius={Radius.sm} />
          </View>
          <View style={styles.actions}>
            <SkeletonBlock width={16} height={16} borderRadius={8} />
            <SkeletonBlock width={56} height={12} borderRadius={Radius.xs} />
            <SkeletonBlock width={24} height={24} borderRadius={Radius.xs} />
            <SkeletonBlock width={36} height={14} borderRadius={Radius.xs} />
            <SkeletonBlock width={22} height={22} borderRadius={Radius.xs} />
            <SkeletonBlock width={24} height={14} borderRadius={Radius.xs} />
            <SkeletonBlock width={22} height={22} borderRadius={Radius.xs} />
            <View style={styles.actionsEnd}>
              <SkeletonBlock width={22} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={22} height={22} borderRadius={Radius.xs} />
            </View>
          </View>
          <SkeletonBlock width="100%" height={16} borderRadius={Radius.xs} style={styles.caption} />
          <SkeletonBlock width="75%" height={16} borderRadius={Radius.xs} style={styles.captionLine} />
          <SkeletonBlock width={90} height={12} borderRadius={Radius.xs} style={styles.meta} />
        </Card>
      </View>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  card: {
    margin: Spacing.md,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  profileText: {
    marginLeft: Spacing.md,
    flex: 1,
    minWidth: 0,
    gap: Spacing.xs,
  },
  profileBar2: {
    marginTop: 2,
  },
  mediaContainer: {
    alignSelf: 'center',
    maxWidth: '100%',
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  actionsEnd: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginLeft: 'auto',
  },
  caption: {
    marginTop: Spacing.sm,
  },
  captionLine: {
    marginTop: Spacing.xs,
  },
  meta: {
    marginTop: Spacing.xs,
  },
});
