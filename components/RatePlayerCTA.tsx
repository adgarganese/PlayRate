import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GradientCard } from '@/components/ui/GradientCard';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius, Shadows, AccentColors } from '@/constants/theme';
import { hapticLight } from '@/lib/haptics';

type RatePlayerCTAProps = {
  onPress: () => void;
  /** When set, title becomes "Rate {name}" / "You rated {name}". */
  playerName?: string;
  hasRated: boolean;
};

function displayName(playerName?: string): string {
  const t = playerName?.trim();
  return t && t.length > 0 ? t : 'this player';
}

export function RatePlayerCTA({ onPress, playerName, hasRated }: RatePlayerCTAProps) {
  const { colors, isDark } = useThemeColors();
  const name = displayName(playerName);
  const titleText = playerName?.trim() ? `Rate ${playerName.trim()}` : 'Rate this player';

  const handleCardPress = () => {
    hapticLight();
    onPress();
  };

  const gradientButton = (
    <View style={[styles.rateButtonShell, isDark ? Shadows.dark.card : Shadows.light.card]} pointerEvents="none">
      <LinearGradient
        colors={[AccentColors.accentGradientEnd, AccentColors.accentGradientDeep]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[StyleSheet.absoluteFillObject, { borderRadius: Radius.sm }]}
      />
      <Text style={[styles.rateButtonLabel, { color: colors.textOnPrimary }]}>Rate</Text>
    </View>
  );

  if (hasRated) {
    return (
      <GradientCard variant="featured" style={styles.card}>
        <View style={styles.row}>
          <IconSymbol name="checkmark.circle.fill" size={28} color={colors.textMuted} />
          <View style={styles.textBlock}>
            <Text style={[Typography.h3, { color: colors.textMuted }]}>You rated {name}</Text>
            <TouchableOpacity
              onPress={handleCardPress}
              accessibilityRole="button"
              accessibilityLabel="Update rating"
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            >
              <Text style={[Typography.body, styles.updateLink, { color: colors.primary }]}>
                Update Rating
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </GradientCard>
    );
  }

  return (
    <AnimatedPressable
      onPress={handleCardPress}
      accessibilityRole="button"
      accessibilityLabel={titleText}
    >
      <GradientCard variant="featured" style={styles.card}>
        <View style={styles.row}>
          <IconSymbol name="star.fill" size={28} color={colors.accentOrange} />
          <View style={[styles.textBlock, styles.textBlockGrow]}>
            <Text style={[Typography.h3, { color: colors.text }]}>{titleText}</Text>
            <Text style={[Typography.muted, styles.subtitle, { color: colors.textMuted }]}>
              Help the community know their skill level
            </Text>
          </View>
          {gradientButton}
        </View>
      </GradientCard>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: Radius.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  textBlock: {
    minWidth: 0,
    gap: Spacing.xs,
  },
  textBlockGrow: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  updateLink: {
    marginTop: Spacing.sm,
    fontWeight: '600',
  },
  rateButtonShell: {
    position: 'relative',
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  rateButtonLabel: {
    ...Typography.mutedSmall,
    fontWeight: '600',
    zIndex: 1,
  },
});
