import { useEffect } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');

/**
 * Very subtle drifting gradient for auth screens (~3–5% opacity, ~8s loop).
 */
export function AuthAmbientBackdrop() {
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(1, { duration: 8000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only ambient loop
  }, []);

  const blobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (t.value - 0.5) * 56 },
      { translateY: (t.value - 0.5) * -44 },
    ],
  }));

  const blob2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: (0.5 - t.value) * 40 },
      { translateY: (t.value - 0.5) * 32 },
    ],
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={[
          styles.blob,
          { top: H * 0.08, left: -W * 0.25, width: W * 1.5, height: H * 0.55 },
          blobStyle,
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(168, 178, 193, 0.055)',
            'rgba(0, 0, 255, 0.035)',
            'rgba(0, 229, 255, 0.04)',
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View
        style={[
          styles.blob,
          { top: H * 0.42, left: W * 0.2, width: W * 1.2, height: H * 0.45 },
          blob2Style,
        ]}
      >
        <LinearGradient
          colors={[
            'rgba(0, 229, 255, 0.035)',
            'rgba(168, 178, 193, 0.05)',
            'rgba(0, 0, 255, 0.03)',
          ]}
          start={{ x: 1, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  blob: {
    position: 'absolute',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
