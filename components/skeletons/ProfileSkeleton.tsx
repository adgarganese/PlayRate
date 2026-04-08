import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';
import { Card } from '@/components/Card';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

export function ProfileSkeleton() {
  const { colors } = useThemeColors();
  return (
    <SkeletonPlaceholder>
      <View style={styles.root}>
        <Card style={styles.heroCard}>
          <View style={styles.heroTop}>
            <SkeletonBlock width={96} height={96} borderRadius={48} />
            <View style={styles.heroTextWrap}>
              <SkeletonBlock width="75%" height={28} borderRadius={Radius.xs} style={styles.nameBar} />
              <SkeletonBlock width="50%" height={18} borderRadius={Radius.xs} style={styles.userBar} />
              <SkeletonBlock width="90%" height={Typography.muted.fontSize + 4} borderRadius={Radius.xs} style={styles.subBar} />
              <SkeletonBlock width="55%" height={12} borderRadius={Radius.xs} style={styles.hintBar} />
            </View>
          </View>
          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <View style={styles.statBlock}>
              <SkeletonBlock width={40} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={56} height={12} borderRadius={Radius.xs} style={styles.statLabelSk} />
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBlock}>
              <SkeletonBlock width={40} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={56} height={12} borderRadius={Radius.xs} style={styles.statLabelSk} />
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.statBlock}>
              <SkeletonBlock width={40} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={64} height={12} borderRadius={Radius.xs} style={styles.statLabelSk} />
            </View>
          </View>
        </Card>

        <View style={styles.pillsRow}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width="100%" height={44} borderRadius={Radius.md} style={styles.pill} />
          ))}
        </View>

        <Card style={styles.contentCard}>
          <SkeletonBlock width={72} height={12} borderRadius={Radius.xs} style={styles.cardTitleSk} />
          <SkeletonBlock width="100%" height={16} borderRadius={Radius.xs} />
          <SkeletonBlock width="95%" height={16} borderRadius={Radius.xs} style={styles.cardLine} />
          <SkeletonBlock width="60%" height={16} borderRadius={Radius.xs} style={styles.cardLine} />
        </Card>

        <Card style={styles.contentCard}>
          <SkeletonBlock width={56} height={12} borderRadius={Radius.xs} style={styles.cardTitleSk} />
          <View style={styles.credibilityRow}>
            <View style={styles.credItem}>
              <SkeletonBlock width={36} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={48} height={12} borderRadius={Radius.xs} style={styles.credLabelSk} />
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.credItem}>
              <SkeletonBlock width={36} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={56} height={12} borderRadius={Radius.xs} style={styles.credLabelSk} />
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.credItem}>
              <SkeletonBlock width={36} height={22} borderRadius={Radius.xs} />
              <SkeletonBlock width={52} height={12} borderRadius={Radius.xs} style={styles.credLabelSk} />
            </View>
          </View>
        </Card>

        <Card style={styles.contentCard}>
          <SkeletonBlock width={88} height={12} borderRadius={Radius.xs} style={styles.cardTitleSk} />
          <SkeletonBlock width="100%" height={72} borderRadius={Radius.sm} />
        </Card>
      </View>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingBottom: Spacing.xl,
  },
  heroCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.lg,
  },
  heroTextWrap: {
    flex: 1,
    marginLeft: Spacing.lg,
    minWidth: 0,
  },
  nameBar: { marginBottom: 2 },
  userBar: { marginBottom: 2 },
  subBar: { marginBottom: 2 },
  hintBar: { marginTop: Spacing.xs },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  statBlock: { alignItems: 'center', minWidth: 80 },
  statLabelSk: { marginTop: 2 },
  statDivider: { width: 1, height: 28 },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  pill: { flex: 1, minWidth: 0 },
  contentCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitleSk: {
    marginBottom: Spacing.md,
  },
  cardLine: {
    marginTop: Spacing.sm,
  },
  credibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  credItem: { alignItems: 'center' },
  credLabelSk: { marginTop: 2 },
});
