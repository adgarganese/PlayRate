import { View, StyleSheet } from 'react-native';
import { Spacing, Radius } from '@/constants/theme';
import { Card } from '@/components/Card';
import { SkeletonPlaceholder } from '@/components/ui/SkeletonPlaceholder';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';

const SKELETON_ROWS = 2;
const SKELETON_COLUMNS = 2;

function CourtGridCardSkeleton() {
  return (
    <Card style={styles.courtCard}>
      <View style={styles.nameBand}>
        <SkeletonBlock width="60%" height={18} borderRadius={Radius.xs} />
      </View>
      <View style={styles.photoSlot}>
        <SkeletonBlock width="100%" height="100%" borderRadius={0} />
      </View>
      <View style={styles.addressBand}>
        <SkeletonBlock width="40%" height={12} borderRadius={Radius.xs} />
      </View>
    </Card>
  );
}

function CourtGridRowSkeleton({ rowIndex }: { rowIndex: number }) {
  return (
    <View style={styles.row}>
      {Array.from({ length: SKELETON_COLUMNS }, (_, columnIndex) => (
        <View key={`${rowIndex}-${columnIndex}`} style={styles.cell}>
          <CourtGridCardSkeleton />
        </View>
      ))}
    </View>
  );
}

export function CourtListSkeleton() {
  return (
    <SkeletonPlaceholder>
      <View style={[styles.list, styles.listFlex]}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <CourtGridRowSkeleton key={i} rowIndex={i} />
        ))}
      </View>
    </SkeletonPlaceholder>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
  },
  listFlex: {
    flex: 1,
  },
  courtCard: {
    padding: 0,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  cell: {
    flex: 1,
  },
  nameBand: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  photoSlot: {
    width: '100%',
    aspectRatio: 3 / 4,
  },
  addressBand: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    justifyContent: 'center',
  },
});
