import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

const AVATAR = 40;

function AthleteRowSkeleton() {
  const { colors } = useThemeColors();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <SkeletonBlock width={AVATAR} height={AVATAR} borderRadius={AVATAR / 2} />
      <View style={styles.textCol}>
        <SkeletonBlock width="55%" height={16} borderRadius={Radius.xs} />
        <SkeletonBlock width="40%" height={14} borderRadius={Radius.xs} style={styles.bar2} />
        <SkeletonBlock width="70%" height={12} borderRadius={Radius.xs} style={styles.bar3} />
      </View>
      <SkeletonBlock width={20} height={20} borderRadius={Radius.xs} style={styles.chevronSlot} />
    </View>
  );
}

type AthleteListSkeletonProps = {
  /** Shown under the skeleton when the main request is still in flight (e.g. slow network). */
  hintText?: string;
};

export function AthleteListSkeleton({ hintText }: AthleteListSkeletonProps) {
  const { colors } = useThemeColors();
  return (
    <SkeletonPlaceholder>
      <View style={[styles.list, styles.listFlex]}>
        {[0, 1, 2, 3, 4].map((i) => (
          <AthleteRowSkeleton key={i} />
        ))}
        {hintText ? (
          <Text style={[styles.hint, Typography.mutedSmall, { color: colors.textMuted }]}>{hintText}</Text>
        ) : null}
      </View>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  listFlex: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  textCol: {
    flex: 1,
    marginLeft: Spacing.md,
    minWidth: 0,
    gap: Spacing.xs,
  },
  bar2: {
    marginTop: 2,
  },
  bar3: {
    marginTop: 2,
  },
  chevronSlot: {
    marginLeft: Spacing.sm,
  },
  hint: {
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
});
