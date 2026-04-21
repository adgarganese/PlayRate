import { Text, TextProps } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Typography } from '@/constants/theme';

type AppTextVariant = keyof typeof Typography;

type AppTextProps = TextProps & {
  variant?: AppTextVariant;
  color?: 'text' | 'textMuted' | 'primary' | 'textOnPrimary';
};

export function AppText({
  variant = 'body',
  color = 'text',
  style,
  ...props
}: AppTextProps) {
  const { colors, isDark } = useThemeColors();

  const variantStyle = Typography[variant];
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
