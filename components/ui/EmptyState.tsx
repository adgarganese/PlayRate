import { useEffect, type ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconSymbol, type IconSymbolName } from './icon-symbol';
import { Spacing, AccentColors } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Defaults to highlight / play icon when no `illustration` */
  icon?: IconSymbolName;
  /** Custom SVG (or other) art; replaces icon + glow when set */
  illustration?: ReactNode;
};

const ICON_AREA = 120;
const PULSE_MS = 1000;

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
  icon = 'play.rectangle.fill',
  illustration,
}: EmptyStateProps) {
  const { colors } = useThemeColors();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: PULSE_MS, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [scale]);

  const iconPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <View style={styles.iconSection}>
        {illustration ? (
          <Animated.View style={[styles.illustrationLayer, iconPulseStyle]}>
            {illustration}
          </Animated.View>
        ) : (
          <>
            <View style={styles.iconGlowClip}>
              <LinearGradient
                colors={[
                  `${AccentColors.accentElectric}0D`,
                  `${AccentColors.accentElectric}00`,
                  'transparent',
                ]}
                locations={[0, 0.45, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.iconGlow}
              />
            </View>
            <Animated.View style={[styles.iconLayer, iconPulseStyle]}>
              <IconSymbol name={icon} size={40} color={colors.textMuted} />
            </Animated.View>
          </>
        )}
      </View>
      <AppText variant="body" color="textMuted" style={styles.title}>
        {title}
      </AppText>
      {subtitle && (
        <AppText variant="mutedSmall" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconSection: {
    width: ICON_AREA,
    height: ICON_AREA,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  iconGlowClip: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    width: ICON_AREA,
    height: ICON_AREA,
    borderRadius: ICON_AREA / 2,
  },
  iconLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationLayer: {
    width: ICON_AREA,
    height: ICON_AREA,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.md,
  },
});
