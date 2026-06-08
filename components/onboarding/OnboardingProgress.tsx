import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius } from '@/constants/theme';

type OnboardingProgressProps = {
  /** 1-based current step */
  current: number;
  /** Total steps in the flow (onboarding uses 5: sports → ratings → courts → players → done) */
  total: number;
};

export function OnboardingProgress({ current, total }: OnboardingProgressProps) {
  const { colors } = useThemeColors();
  const [trackWidth, setTrackWidth] = useState(0);
  const fillWidth = useSharedValue(0);
  const progress = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;

  useEffect(() => {
    fillWidth.value = withTiming(trackWidth * progress, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [fillWidth, progress, trackWidth]);

  const fillStyle = useAnimatedStyle(() => ({
    width: fillWidth.value,
  }));

  return (
    <View
      style={[styles.track, { backgroundColor: colors.border }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: total, now: current }}
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: colors.primary },
          fillStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: Radius.full,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
