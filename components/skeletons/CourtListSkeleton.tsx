import { View, StyleSheet } from 'react-native';
import { Spacing, Radius } from '@/constants/theme';
import { Card } from '@/components/Card';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

const PHOTO_SIZE = 56;

function CourtRowSkeleton() {
  return (
    <Card style={styles.courtCard}>
      <View style={styles.row}>
        <SkeletonBlock width={PHOTO_SIZE} height={PHOTO_SIZE} borderRadius={Radius.sm} />
        <View style={styles.textCol}>
          <View style={styles.titleRow}>
            <SkeletonBlock width="100%" height={18} borderRadius={Radius.xs} style={styles.nameBar} />
            <SkeletonBlock width={72} height={22} borderRadius={Radius.xs} />
          </View>
          <SkeletonBlock width="85%" height={14} borderRadius={Radius.xs} style={styles.locBar} />
          <SkeletonBlock width={100} height={12} borderRadius={Radius.xs} style={styles.ratingBar} />
        </View>
      </View>
    </Card>
  );
}

export function CourtListSkeleton() {
  return (
    <SkeletonPlaceholder>
      <View style={[styles.list, styles.listFlex]}>
        {[0, 1, 2, 3].map((i) => (
          <CourtRowSkeleton key={i} />
        ))}
      </View>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  listFlex: {
    flex: 1,
  },
  courtCard: {
    marginBottom: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
    paddingTop: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  nameBar: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.sm,
  },
  locBar: {
    marginBottom: Spacing.sm,
  },
  ratingBar: {
    marginTop: 2,
  },
});
