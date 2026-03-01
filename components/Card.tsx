import { View, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Radius, Spacing, Shadows } from '@/constants/theme';

type CardProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
};

export function Card({ children, style, elevated = false }: CardProps) {
  const { colors, isDark } = useThemeColors();
  const shadowStyle = elevated 
    ? (isDark ? Shadows.dark.elevated : Shadows.light.elevated)
    : (isDark ? Shadows.dark.card : Shadows.light.card);

  return (
    <View 
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          ...shadowStyle,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
  },
});
