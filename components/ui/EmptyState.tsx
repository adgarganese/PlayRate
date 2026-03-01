import { View, StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <AppText variant="body" color="textMuted" style={styles.title}>
        {title}
      </AppText>
      {subtitle && (
        <AppText variant="mutedSmall" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      )}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  button: {
    marginTop: Spacing.md,
  },
});
