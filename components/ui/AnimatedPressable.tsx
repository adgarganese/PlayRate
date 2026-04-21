import { Pressable, type PressableProps, type PressableStateCallbackType } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

const SPRING = { damping: 18, stiffness: 380, mass: 0.45 };
const PRESSED_SCALE = 0.97;

/**
 * Drop-in Pressable with subtle scale-down on press (0.97 → 1 via spring).
 */
export function AnimatedPressable({
  children,
  style,
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableProps) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const resolvedStyle: PressableProps['style'] =
    typeof style === 'function'
      ? (state: PressableStateCallbackType) => [style(state), animatedStyle]
      : [style, animatedStyle];

  return (
    <AnimatedPressableBase
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        if (!disabled) {
          scale.value = withSpring(PRESSED_SCALE, SPRING);
        }
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!disabled) {
          scale.value = withSpring(1, SPRING);
        }
        onPressOut?.(e);
      }}
      style={resolvedStyle}
    >
      {children}
    </AnimatedPressableBase>
  );
}
