import { View, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius } from '@/constants/theme';

type OnboardingProgressProps = {
  /** 1-based current step */
  current: number;
  /** Total steps in the flow (onboarding uses 5: sports → ratings → courts → players → done) */
  total: number;
};

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const { colors } = useThemeColors();

  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {Array.from({ length: total }, (_, i) => {
        const step = i + 1;
        const active = step <= current;
        return (
          <View
            key={step}
            style={[
              styles.dot,
              {
                backgroundColor: active ? colors.primary : colors.border,
                opacity: active ? 1 : 0.45,
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: Radius.full,
  },
});
