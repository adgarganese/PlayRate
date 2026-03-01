import { StyleSheet, type ViewStyle } from 'react-native';
import { Card } from '@/components/Card';
import { AppText } from './AppText';
import { Button } from './Button';
import { Spacing } from '@/constants/theme';

type CompactEmptyStateCardProps = {
  title: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
};

export function CompactEmptyStateCard({
  title,
  subtitle,
  actionLabel,
  onAction,
}: CompactEmptyStateCardProps) {
  return (
    <Card style={styles.card}>
      <AppText variant="body" color="textMuted" style={styles.title}>
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="mutedSmall" color="textMuted" style={styles.subtitle}>
          {subtitle}
        </AppText>
      ) : null}
      <Button
        title={actionLabel}
        onPress={onAction}
        variant="secondary"
        size="medium"
        style={StyleSheet.flatten([styles.button, styles.pillShape]) as ViewStyle}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  button: {
    alignSelf: 'center',
    marginTop: Spacing.xs,
  },
  pillShape: {
    borderRadius: 999,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
});
