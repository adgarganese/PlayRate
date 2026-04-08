import { useEffect } from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useThemeColors } from '@/contexts/theme-context';

const AnimatedLine = Animated.createAnimatedComponent(Line);

/** Empty bubble + blinking cursor bar. */
export function EmptyInboxIllustration() {
  const { colors } = useThemeColors();
  const muted = colors.textMuted;
  const accent = colors.primary;
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 500 }), withTiming(1, { duration: 500 })),
      -1,
      false
    );
  }, [opacity]);

  const cursorProps = useAnimatedProps(() => ({
    opacity: opacity.value,
  }));

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Rect
        x={22}
        y={34}
        width={76}
        height={52}
        rx={14}
        stroke={muted}
        strokeWidth={2.5}
        fill="none"
      />
      <Line x1={42} y1={54} x2={72} y2={54} stroke={muted} strokeWidth={2} strokeLinecap="round" opacity={0.45} />
      <AnimatedLine
        x1={79}
        y1={44}
        x2={79}
        y2={64}
        stroke={accent}
        strokeWidth={2.5}
        strokeLinecap="round"
        animatedProps={cursorProps}
      />
    </Svg>
  );
}
