import type { ComponentProps } from 'react';
import { Text, View, StyleSheet, ViewStyle, ActivityIndicator, type AccessibilityRole } from 'react-native';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

type ProfileNavPillProps = {
  icon: ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  loading?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  /** When set, overrides default icon size (16, or 11 when compact). */
  iconSize?: number;
  /** When true, applies a subtle active state (e.g. Following) – different border/surface, in-family with pill system */
  active?: boolean;
  /** When true, uses ~66% size (for Cosign buttons in modals) */
  compact?: boolean;
  /** Vertical stack: icon centered above label (e.g. court action row). Default horizontal. */
  layout?: 'horizontal' | 'vertical';
  accent?: 'checkIn';
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
};

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: 999,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  pillCompact: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 6,
  },
  pillVertical: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    minWidth: 0,
  },
  verticalIconWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillPressed: {
    opacity: 0.6,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  pillText: {
    ...Typography.mutedSmall,
    fontWeight: '500',
  },
  pillTextCompact: {
    fontSize: 10,
    lineHeight: 14,
  },
  pillTextVertical: {
    ...Typography.mutedSmall,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
});

export function ProfileNavPill({
  icon,
  label,
  onPress,
  style,
  loading = false,
  disabled = false,
  showChevron = true,
  iconSize: iconSizeProp,
  active = false,
  compact = false,
  layout = 'horizontal',
  accent,
  accessibilityLabel,
  accessibilityRole,
}: ProfileNavPillProps) {
  const { colors } = useThemeColors();
  const isDisabled = disabled || loading;
  const energyTint = accent === 'checkIn' ? colors.accentOrange : null;
  const iconColor = energyTint ?? (active ? colors.primary : colors.textMuted);
  const textColor = energyTint ?? (active ? colors.primary : colors.textMuted);
  const iconSize = iconSizeProp ?? (compact ? 11 : 16);
  const chevronSize = compact ? 10 : 14;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole}
      hitSlop={compact ? { top: 12, bottom: 12, left: 12, right: 12 } : { top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        pillStyles.pill,
        compact && pillStyles.pillCompact,
        layout === 'vertical' && pillStyles.pillVertical,
        {
          borderColor: energyTint ?? (active ? colors.primary : colors.border),
          backgroundColor: active ? colors.surfaceAlt : undefined,
        },
        pressed && !isDisabled && pillStyles.pillPressed,
        isDisabled && pillStyles.pillDisabled,
        style,
      ]}
    >
      {layout === 'vertical' ? (
        <View style={pillStyles.verticalIconWrap}>
          {loading ? (
            <ActivityIndicator size="small" color={iconColor} />
          ) : (
            <IconSymbol name={icon} size={iconSize} color={iconColor} />
          )}
        </View>
      ) : loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <IconSymbol name={icon} size={iconSize} color={iconColor} />
      )}
      <Text
        style={[
          layout === 'vertical' ? pillStyles.pillTextVertical : pillStyles.pillText,
          compact && pillStyles.pillTextCompact,
          { color: textColor },
        ]}
        numberOfLines={layout === 'vertical' ? 2 : 1}
      >
        {label}
      </Text>
      {showChevron && layout === 'horizontal' && (
        <IconSymbol name="chevron.right" size={chevronSize} color={iconColor} />
      )}
    </AnimatedPressable>
  );
}
