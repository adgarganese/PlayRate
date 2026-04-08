import {
  createContext,
  useContext,
  useEffect,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

const SHIMMER_HALF_MS = 750;

type SkeletonShimmerContextValue = {
  opacity: SharedValue<number>;
};

const SkeletonShimmerContext = createContext<SkeletonShimmerContextValue | null>(null);

export function useSkeletonShimmer(): SkeletonShimmerContextValue | null {
  return useContext(SkeletonShimmerContext);
}

/**
 * Wraps skeleton layouts so all {@link SkeletonBlock} instances share one shimmer timing (0.3 → 0.7 → 0.3, ~1.5s loop).
 */
export function SkeletonPlaceholder({ children }: { children: ReactNode }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.7, {
          duration: SHIMMER_HALF_MS,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(0.3, {
          duration: SHIMMER_HALF_MS,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      false
    );
  }, [opacity]);

  return (
    <SkeletonShimmerContext.Provider value={{ opacity }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={{ flex: 1 }}
      >
        {children}
      </View>
    </SkeletonShimmerContext.Provider>
  );
}
