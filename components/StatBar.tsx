import { View, Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

type StatBarProps = {
  label: string;
  value: number; // 0-100
};

export function StatBar({ label, value }: StatBarProps) {
  const { colors } = useThemeColors();
  const clampedValue = Math.max(0, Math.min(100, value));
  // Convert 0-100 to 0-10 scale with 1 decimal place
  const displayValue = (clampedValue / 10).toFixed(1);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.textMuted }]}>
          {label}
        </Text>
        <Text style={[styles.valueText, { color: colors.text }]}>
          {displayValue}
        </Text>
      </View>
      <View style={[styles.barContainer, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.barFill, 
            { 
              width: `${clampedValue}%`,
              backgroundColor: colors.primary,
            }
          ]} 
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 3,
  },
  label: {
    ...Typography.mutedSmall,
  },
  valueText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  barContainer: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
});
