import { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/Card';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius, Shadows, AccentColors } from '@/constants/theme';
import { useOnboardingExit } from '@/hooks/use-onboarding-exit';
import { hapticLight, hapticSuccess } from '@/lib/haptics';

export default function OnboardingDoneScreen() {
  const { exitToHome } = useOnboardingExit();
  const { colors, isDark } = useThemeColors();

  useEffect(() => {
    hapticSuccess();
  }, []);

  const heroCardStyle = StyleSheet.flatten([
    styles.card,
    isDark ? Shadows.dark.featuredGlow : Shadows.light.featuredGlow,
  ]);
  const heroGradient = [
    AccentColors.accentGradientStart,
    AccentColors.accentGradientEnd,
    AccentColors.accentGradientDeep,
  ] as const;

  const skipButton = (
    <TouchableOpacity
      onPress={() => void exitToHome()}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Skip onboarding"
    >
      <AppText variant="muted" color="primary" style={styles.skipLabel}>
        Skip
      </AppText>
    </TouchableOpacity>
  );

  return (
    <Screen>
      <Header title="Welcome to PlayRate" showBack={false} rightElement={skipButton} />
      <OnboardingProgress current={5} total={5} />
      <Card style={heroCardStyle}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.iconBadge}>
            <IconSymbol name="basketball.fill" size={26} color={colors.textOnPrimary} />
          </View>
          <AppText variant="h1" color="textOnPrimary" style={styles.heroTitle}>
            {"You're on the court."}
          </AppText>
          <AppText variant="body" color="textOnPrimary" style={styles.message}>
            Time to find your courts and show off your game.
          </AppText>
        </LinearGradient>
      </Card>
      <View style={styles.footer}>
        <Button
          title="Hit the court"
          onPress={() => {
            hapticLight();
            void exitToHome();
          }}
          variant="primary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipLabel: { paddingTop: 4 },
  card: {
    marginBottom: Spacing.lg,
    padding: 0,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  heroGradient: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  iconBadge: {
    width: 54,
    height: 54,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    marginBottom: Spacing.lg,
  },
  heroTitle: {
    ...Typography.h1,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    lineHeight: 24,
    textAlign: 'center',
  },
  footer: { marginTop: Spacing.md },
});
