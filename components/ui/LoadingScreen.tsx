import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Screen } from './Screen';
import { AppText } from './AppText';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';

const AnimatedText = Animated.createAnimatedComponent(Text);

type LoadingScreenProps = {
  message?: string;
};

const PULSE_HALF_MS = 750;

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const { colors } = useThemeColors();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.4, { duration: PULSE_HALF_MS, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      false
    );
  }, [opacity]);

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Screen>
      <View style={styles.container}>
        <AnimatedText
          style={[
            styles.wordmark,
            { color: colors.text },
            wordmarkStyle,
          ]}
          accessibilityLabel="PlayRate loading"
        >
          PlayRate
        </AnimatedText>
        <AppText variant="body" color="textMuted" style={styles.text}>
          {message}
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  wordmark: {
    fontFamily: 'BarlowCondensed-ExtraBoldItalic',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  text: {
    textAlign: 'center',
  },
});
