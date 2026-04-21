import { useEffect } from 'react';
import { View, Text, StyleSheet, ViewStyle, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, AccentColors } from '@/constants/theme';

const TITLE_CYAN_GLOW = 'rgba(0, 229, 255, 0.38)';

const TAGLINE = 'Find runs. Get rated. Level up.';
const RULE_WIDTH_PCT = 0.6;
const TITLE_DURATION_MS = 300;
const TAGLINE_DELAY_MS = 200;
const TAGLINE_DURATION_MS = 280;

const AnimatedText = Animated.createAnimatedComponent(Text);

type PlayRatePlaceholderProps = {
  style?: ViewStyle;
};

/**
 * Text placeholder for brand: PlayRate + tagline + subtle motion and chrome.
 */
export function PlayRatePlaceholder({ style }: PlayRatePlaceholderProps) {
  const { colors } = useThemeColors();
  const titleOpacity = useSharedValue(0);
  const tagOpacity = useSharedValue(0);
  const tagTranslateY = useSharedValue(8);
  const ruleWidth = Dimensions.get('window').width * RULE_WIDTH_PCT;

  useEffect(() => {
    titleOpacity.value = withTiming(1, {
      duration: TITLE_DURATION_MS,
      easing: Easing.out(Easing.cubic),
    });
    tagOpacity.value = withDelay(
      TAGLINE_DELAY_MS,
      withTiming(1, {
        duration: TAGLINE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
    tagTranslateY.value = withDelay(
      TAGLINE_DELAY_MS,
      withTiming(0, {
        duration: TAGLINE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- entrance run once on mount
  }, []);

  const titleAnimStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const tagAnimStyle = useAnimatedStyle(() => ({
    opacity: tagOpacity.value,
    transform: [{ translateY: tagTranslateY.value }],
  }));

  const titleShadowStyle = {
    textShadowColor: TITLE_CYAN_GLOW,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: Platform.OS === 'android' ? 10 : 14,
  };

  return (
    <View style={[styles.container, style]}>
      <AnimatedText
        style={[
          styles.title,
          { color: colors.text },
          titleShadowStyle,
          titleAnimStyle,
        ]}
        numberOfLines={1}
        accessibilityRole="header"
        accessibilityLabel="PlayRate"
      >
        PlayRate
      </AnimatedText>
      <AnimatedText
        style={[styles.tagline, { color: colors.textMuted }, tagAnimStyle]}
      >
        {TAGLINE}
      </AnimatedText>
      <LinearGradient
        colors={['transparent', AccentColors.accentPink, 'transparent']}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={[styles.rule, { width: ruleWidth }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  title: {
    fontFamily: 'BarlowCondensed-ExtraBoldItalic',
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 10,
    textAlign: 'center',
    includeFontPadding: false,
  },
  rule: {
    height: StyleSheet.hairlineWidth * 2,
    marginTop: Spacing.md,
    alignSelf: 'center',
    borderRadius: 1,
  },
});
