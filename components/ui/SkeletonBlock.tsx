import { StyleSheet, type DimensionValue, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { useThemeColors } from '@/contexts/theme-context';
import { Radius } from '@/constants/theme';
import { useSkeletonShimmer } from '@/components/ui/SkeletonPlaceholder';

type SkeletonBlockProps = {
  width: number | DimensionValue;
  height: number | DimensionValue;
  borderRadius?: number;
  style?: ViewStyle;
};

/**
 * Atomic shimmer block; must be used inside {@link SkeletonPlaceholder} for synchronized pulse.
 */
export function SkeletonBlock({
  width,
  height,
  borderRadius = Radius.xs,
  style,
}: SkeletonBlockProps) {
  const { colors, isDark } = useThemeColors();
  const ctx = useSkeletonShimmer();

  const animatedStyle = useAnimatedStyle(() => {
    const o = ctx?.opacity.value ?? 0.5;
    return { opacity: o };
  });

  const baseColor = isDark ? colors.surfaceAlt : colors.border;

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width: width as DimensionValue,
          height: height as DimensionValue,
          borderRadius,
          backgroundColor: baseColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
