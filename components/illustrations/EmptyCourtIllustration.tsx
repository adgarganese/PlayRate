import { useEffect } from 'react';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/contexts/theme-context';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Half court (top view) + bouncing ball. */
export function EmptyCourtIllustration() {
  const { colors } = useThemeColors();
  const muted = colors.textMuted;
  const accent = colors.accentOrange;
  const cy = useSharedValue(52);

  useEffect(() => {
    cy.value = withRepeat(
      withSequence(
        withTiming(46, { duration: 380, easing: Easing.out(Easing.quad) }),
        withTiming(52, { duration: 380, easing: Easing.in(Easing.quad) })
      ),
      -1,
      false
    );
  }, [cy]);

  const ballProps = useAnimatedProps(() => ({
    cy: cy.value,
  }));

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Path
        d="M 24 88 L 96 88 L 96 32 L 24 32 Z"
        stroke={muted}
        strokeWidth={2}
        fill="none"
        strokeLinejoin="round"
      />
      <Line x1={60} y1={32} x2={60} y2={88} stroke={muted} strokeWidth={1.5} />
      <Circle cx={60} cy={60} r={14} stroke={muted} strokeWidth={1.5} fill="none" />
      <Path d="M 24 50 Q 42 42 60 50" stroke={muted} strokeWidth={1.5} fill="none" />
      <AnimatedCircle
        cx={78}
        r={5}
        stroke={accent}
        strokeWidth={2}
        fill="none"
        animatedProps={ballProps}
      />
    </Svg>
  );
}
