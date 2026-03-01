import { View, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { AppText } from './AppText';
import { Button } from './Button';
import { Spacing } from '@/constants/theme';

type ErrorScreenProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

export function ErrorScreen({
  title = 'Error',
  message,
  onRetry,
  retryLabel = 'Retry',
}: ErrorScreenProps) {
  return (
    <Screen>
      <View style={styles.container}>
        <AppText variant="h3" color="text" style={styles.title}>
          {title}
        </AppText>
        <AppText variant="muted" color="textMuted" style={styles.message}>
          {message}
        </AppText>
        {onRetry && (
          <Button
            title={retryLabel}
            onPress={onRetry}
            variant="primary"
            style={styles.button}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  title: {
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.md,
  },
});
