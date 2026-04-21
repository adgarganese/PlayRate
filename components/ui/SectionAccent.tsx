import { View, StyleSheet } from 'react-native';
import { Spacing } from '@/constants/theme';

const LINE = 2;

const PINK_LINE = 'rgba(255, 45, 85, 0.3)';
const CYAN_LINE = 'rgba(0, 229, 255, 0.3)';

type SectionAccentProps = {
  tone?: 'pink' | 'cyan';
};

export function SectionAccent({ tone = 'pink' }: SectionAccentProps) {
  return (
    <View
      style={[styles.bar, { backgroundColor: tone === 'cyan' ? CYAN_LINE : PINK_LINE }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    height: LINE,
    width: '100%',
    marginBottom: Spacing.xs,
    borderRadius: 1,
  },
});
