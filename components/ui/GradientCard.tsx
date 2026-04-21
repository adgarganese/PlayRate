import type { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/contexts/theme-context';
import { Radius, Spacing, Shadows, AccentColors } from '@/constants/theme';

type GradientCardVariant = 'default' | 'featured' | 'subtle';

type GradientCardProps = {
  children: ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  variant?: GradientCardVariant;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = hex.replace('#', '');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return { r, g, b };
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function GradientCard({
  children,
  style,
  elevated = false,
  variant = 'default',
}: GradientCardProps) {
  const { colors, isDark } = useThemeColors();

  const flat = StyleSheet.flatten(style) as ViewStyle | undefined;
  const borderRadius = flat?.borderRadius ?? Radius.md;

  const shadowStyle =
    variant === 'featured'
      ? (isDark ? Shadows.dark.featuredGlow : Shadows.light.featuredGlow)
      : elevated
        ? (isDark ? Shadows.dark.elevated : Shadows.light.elevated)
        : (isDark ? Shadows.dark.card : Shadows.light.card);

  let gradientColors: [string, string, ...string[]];
  let start = { x: 0, y: 0 };
  let end = { x: 0, y: 1 };

  if (variant === 'featured') {
    const base = colors.surfaceElevated;
    const tint = withAlpha(AccentColors.accentElectric, isDark ? 0.08 : 0.06);
    gradientColors = [base, tint];
    end = { x: 1, y: 1 };
  } else if (variant === 'subtle') {
    gradientColors = [
      colors.surfaceAlt,
      withAlpha(colors.bg, isDark ? 0.14 : 0.08),
    ];
  } else {
    gradientColors = [colors.surface, colors.surfaceAlt];
  }

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: colors.border,
          ...shadowStyle,
        },
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
        style={[StyleSheet.absoluteFillObject, { borderRadius }]}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
});
