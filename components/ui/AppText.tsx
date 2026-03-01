import { Text, StyleSheet, TextProps } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Typography } from '@/constants/theme';

type AppTextProps = TextProps & {
  variant?: 'h1' | 'h2' | 'h3' | 'body' | 'bodyBold' | 'muted' | 'mutedSmall';
  color?: 'text' | 'textMuted' | 'primary' | 'textOnPrimary';
};

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  ...props
}: AppTextProps) {
  const { colors, isDark } = useThemeColors();

  const variantStyle = variantStyles[variant];
  const isSmallPrimary = color === 'primary' && (variant === 'muted' || variant === 'mutedSmall');
  const colorValue = color === 'text' ? colors.text :
                     color === 'textMuted' ? colors.textMuted :
                     color === 'primary' ? (isSmallPrimary ? colors.primarySmallText : colors.primary) :
                     colors.textOnPrimary;
  const smallPrimaryDarkWeight = isSmallPrimary && isDark ? { fontWeight: '600' as const } : undefined;

  return (
    <Text
      style={[
        variantStyle,
        { color: colorValue },
        smallPrimaryDarkWeight,
        style,
      ]}
      {...props}
    />
  );
}

const variantStyles = StyleSheet.create({
  h1: Typography.h1,
  h2: Typography.h2,
  h3: Typography.h3,
  body: Typography.body,
  bodyBold: Typography.bodyBold,
  muted: Typography.muted,
  mutedSmall: Typography.mutedSmall,
});
