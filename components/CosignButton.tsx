import { useRef } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  Animated,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Typography, AccentColors } from '@/constants/theme';

type CosignButtonProps = {
  /** Number of cosigns to display in badge (optional) */
  count?: number;
  /** Whether loading/submitting */
  loading?: boolean;
  /** Whether disabled */
  disabled?: boolean;
  /** Whether already cosigned (active state) */
  cosigned?: boolean;
  /** Press handler */
  onPress: () => void;
  /** Optional style overrides */
  style?: ViewStyle;
};

export function CosignButton({
  count,
  loading = false,
  disabled = false,
  cosigned = false,
  onPress,
  style,
}: CosignButtonProps) {
  const { isDark } = useThemeColors();
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const badgeScaleAnim = useRef(new Animated.Value(1)).current;
  const isDisabled = disabled || loading;

  // Gold accent colors
  const goldColor = AccentColors.goldTier;
  const goldSoft = AccentColors.goldSoft;

  // Dynamic colors based on state
  const borderColor = cosigned ? goldColor : isDark ? goldSoft : goldColor;
  const iconColor = cosigned ? goldColor : isDark ? goldSoft : goldColor;
  const textColor = cosigned ? goldColor : isDark ? goldSoft : goldColor;
  const bgColor = cosigned
    ? isDark
      ? 'rgba(231, 198, 106, 0.12)'
      : 'rgba(231, 198, 106, 0.08)'
    : 'transparent';

  const handlePressIn = () => {
    // Scale down animation
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    // Scale back up
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePress = async () => {
    if (isDisabled) return;

    // Light haptic feedback
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Badge pop animation if count exists
    if (count !== undefined) {
      Animated.sequence([
        Animated.timing(badgeScaleAnim, {
          toValue: 1.2,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.spring(badgeScaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          speed: 20,
          bounciness: 8,
        }),
      ]).start();
    }

    onPress();
  };

  const label = cosigned ? 'Cosigned' : 'Cosign';
  const icon = cosigned ? 'checkmark.circle.fill' : 'medal.fill';

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        style={[
          styles.pill,
          {
            borderColor,
            backgroundColor: bgColor,
          },
          isDisabled && styles.pillDisabled,
        ]}
      >
        {/* Left icon */}
        {loading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <IconSymbol name={icon} size={11} color={iconColor} />
        )}

        {/* Label */}
        <Text
          style={[styles.label, { color: textColor }]}
          numberOfLines={1}
        >
          {label}
        </Text>

        {/* Right count badge */}
        {count !== undefined && count > 0 && (
          <Animated.View
            style={[
              styles.countBadge,
              {
                backgroundColor: goldColor,
                transform: [{ scale: badgeScaleAnim }],
              },
            ]}
          >
            <Text style={styles.countText}>{count}</Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    gap: 5,
    minHeight: 24,
  },
  pillDisabled: {
    opacity: 0.5,
  },
  label: {
    ...Typography.mutedSmall,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '600',
  },
  countBadge: {
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#0B1020', // Dark text on gold badge for contrast
  },
});
