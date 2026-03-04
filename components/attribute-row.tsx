import { View, Text, StyleSheet } from 'react-native';
import { CosignButton } from './CosignButton';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';

type AttributeRowProps = {
  attributeName: string;
  sportName: string;
  selfRating: number;
  cosignCount: number;
  canCosign?: boolean;
  /** Whether the current user has already cosigned this attribute */
  hasCosigned?: boolean;
  /** Cosign is within pending window (e.g. 30 days); show pill dimmed */
  isCosignPending?: boolean;
  /** Loading state for cosign action */
  cosignLoading?: boolean;
  onCosignPress?: () => void;
};

export default function AttributeRow({
  attributeName,
  sportName,
  selfRating,
  cosignCount,
  canCosign = false,
  hasCosigned = false,
  cosignLoading = false,
  onCosignPress,
}: AttributeRowProps) {
  const { colors } = useThemeColors();
  
  return (
    <View style={[styles.container, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      {/* Top row: skill name left, rating pill right */}
      <View style={styles.row}>
        <View style={[styles.nameBlock, { flex: 1 }]}>
          <Text style={[styles.attributeName, { color: colors.text }]} numberOfLines={1}>
            {attributeName}
          </Text>
          <Text style={[styles.metaText, { color: colors.textMuted }]} numberOfLines={1}>
            {sportName}{cosignCount > 0 ? ` · ${cosignCount} cosign${cosignCount === 1 ? '' : 's'}` : ''}
          </Text>
        </View>
        <View style={[styles.ratingPill, { borderColor: colors.border }]}>
          <Text style={[styles.ratingText, { color: colors.text }]}>{selfRating}/10</Text>
        </View>
      </View>

      {/* Cosign button - show if user can cosign OR has already cosigned */}
      {(canCosign || hasCosigned || cosignCount > 0) && (
        <View style={styles.cosignRow}>
          <View style={styles.cosignButtonWrap}>
            <CosignButton
              count={cosignCount}
              cosigned={hasCosigned}
              isPending={isCosignPending}
              loading={cosignLoading}
              disabled={!canCosign || hasCosigned}
              onPress={onCosignPress || (() => {})}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xs,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nameBlock: {
    minWidth: 0,
  },
  attributeName: {
    ...Typography.bodyBold,
    fontSize: 14,
    lineHeight: 18,
  },
  metaText: {
    ...Typography.mutedSmall,
    fontSize: 11,
    lineHeight: 14,
    marginTop: 2,
  },
  ratingPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  ratingText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
    fontSize: 12,
  },
  cosignRow: {
    marginTop: Spacing.sm,
  },
  cosignButtonWrap: {
    width: '66%',
    alignSelf: 'center',
  },
});
