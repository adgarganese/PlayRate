import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/Card';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { Spacing } from '@/constants/theme';
import { useOnboardingExit } from '@/hooks/use-onboarding-exit';

export default function OnboardingDoneScreen() {
  const { exitToHome } = useOnboardingExit();

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
      <Header title="You're all set!" subtitle="Welcome to PlayRate." showBack={false} rightElement={skipButton} />
      <OnboardingProgress current={5} total={5} />
      <Card style={styles.card}>
        <AppText variant="body" color="text" style={styles.message}>
          {"You're ready to find courts, join runs, and show off your game."}
        </AppText>
      </Card>
      <View style={styles.footer}>
        <Button title="Let's go" onPress={() => void exitToHome()} variant="primary" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipLabel: { paddingTop: 4 },
  card: { marginBottom: Spacing.lg },
  message: { lineHeight: 24 },
  footer: { marginTop: Spacing.md },
});
