import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography, Shadows, AccentColors } from '@/constants/theme';

const fontWeight600 = '600' as TextStyle['fontWeight'];

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  size?: 'small' | 'medium' | 'large';
  loading?: boolean;
  disabled?: boolean;
  /** Primary only: silver metallic gradient fill (e.g. auth CTAs). */
  primaryGradient?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  loading = false,
  disabled = false,
  primaryGradient = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, isDark } = useThemeColors();
  const isPrimary = variant === 'primary';
  const isDisabled = disabled || loading;
  const useGradient = isPrimary && primaryGradient;
  
  const sizeStyles = sizeStylesMap[size];

  return (
    <TouchableOpacity
      style={[
        styles.button,
        sizeStyles.container,
        isPrimary && !useGradient ? {
          backgroundColor: colors.primary,
          ...(isDark ? Shadows.dark.card : Shadows.light.card),
        } : null,
        isPrimary && useGradient ? {
          backgroundColor: 'transparent',
          overflow: 'hidden',
          ...(isDark ? Shadows.dark.card : Shadows.light.card),
        } : null,
        !isPrimary ? {
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: colors.primary,
        } : null,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled }}
    >
      {useGradient ? (
        <LinearGradient
          colors={[AccentColors.accentGradientEnd, AccentColors.accentGradientDeep]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.sm }]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isPrimary ? colors.textOnPrimary : colors.primary}
          style={useGradient ? styles.foreground : undefined}
        />
      ) : (
        <Text
          style={[
            sizeStyles.text,
            isPrimary ? {
              color: colors.textOnPrimary,
            } : {
              color: colors.primary,
            },
            isDisabled && styles.disabledText,
            useGradient && styles.foreground,
            textStyle,
          ]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const sizeStylesMap = {
  small: {
    container: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      minHeight: 36,
    },
    text: {
      ...Typography.mutedSmall,
      fontWeight: fontWeight600,
    },
  },
  medium: {
    container: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      minHeight: 44,
    },
    text: {
      ...Typography.body,
      fontWeight: fontWeight600,
    },
  },
  large: {
    container: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.lg,
      minHeight: 52,
    },
    text: Typography.bodyBold,
  },
};

const styles = StyleSheet.create({
  button: {
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
  },
  disabled: {
    opacity: 0.5,
  },
  disabledText: {
    opacity: 0.6,
  },
  foreground: {
    zIndex: 1,
  },
});
