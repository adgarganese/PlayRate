import { Pressable, Text, StyleSheet, ViewStyle, ActivityIndicator } from 'react-native';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

type ProfileNavPillProps = {
  icon: React.ComponentProps<typeof IconSymbol>['name'];
  label: string;
  onPress: () => void;
  style?: ViewStyle;
  loading?: boolean;
  disabled?: boolean;
  showChevron?: boolean;
  /** When true, applies a subtle active state (e.g. Following) – different border/surface, in-family with pill system */
  active?: boolean;
  /** When true, uses ~66% size (for Cosign buttons in modals) */
  compact?: boolean;
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
});

export function ProfileNavPill({
  icon,
  label,
  onPress,
  style,
  loading = false,
  disabled = false,
  showChevron = true,
  active = false,
  compact = false,
}: ProfileNavPillProps) {
  const { colors } = useThemeColors();
  const isDisabled = disabled || loading;
  const iconColor = active ? colors.primary : colors.textMuted;
  const textColor = active ? colors.primary : colors.textMuted;
  const iconSize = compact ? 11 : 16;
  const chevronSize = compact ? 10 : 14;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      hitSlop={compact ? { top: 12, bottom: 12, left: 12, right: 12 } : { top: 8, bottom: 8, left: 8, right: 8 }}
      style={({ pressed }) => [
        pillStyles.pill,
        compact && pillStyles.pillCompact,
        { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceAlt : undefined },
        pressed && !isDisabled && pillStyles.pillPressed,
        isDisabled && pillStyles.pillDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <IconSymbol name={icon} size={iconSize} color={iconColor} />
      )}
      <Text style={[pillStyles.pillText, compact && pillStyles.pillTextCompact, { color: textColor }]} numberOfLines={1}>
        {label}
      </Text>
      {showChevron && (
        <IconSymbol name="chevron.right" size={chevronSize} color={iconColor} />
      )}
    </Pressable>
  );
}
