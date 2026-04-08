import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { hapticSelection } from '@/lib/haptics';
import { Spacing, Radius, Typography } from '@/constants/theme';

type SegmentedControlProps = {
  options: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
};

export function SegmentedControl({
  options,
  selectedIndex,
  onSelect,
}: SegmentedControlProps) {
  const { colors } = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.surfaceAlt }]}>
      {options.map((option, index) => {
        const isSelected = index === selectedIndex;
        return (
          <TouchableOpacity
            key={index}
            style={[
              styles.segment,
              isSelected && {
                backgroundColor: colors.primary,
              },
            ]}
            onPress={() => {
              if (index === selectedIndex) return;
              hapticSelection();
              onSelect(index);
            }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={option}
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isSelected ? colors.textOnPrimary : colors.text },
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Radius.sm,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentText: {
    ...Typography.bodyBold,
  },
});
