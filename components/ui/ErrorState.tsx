import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { IconSymbol } from './icon-symbol';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';

type ErrorStateProps = {
  onRetry?: () => void;
  retryLabel?: string;
  title?: string;
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

export function ErrorState({
  onRetry,
  retryLabel = 'Try Again',
  title = 'Something went wrong',
  subtitle = "We couldn't load this. Please try again.",
  style,
}: ErrorStateProps) {
  const { colors } = useThemeColors();

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <IconSymbol name="exclamationmark.triangle.fill" size={36} color={colors.textMuted} />
      </View>
      <AppText variant="bodyBold" color="text" style={styles.title}>
        {title}
      </AppText>
      <AppText variant="muted" color="textMuted" style={styles.subtitle}>
        {subtitle}
      </AppText>
      {onRetry ? (
        <Button title={retryLabel} onPress={onRetry} variant="primary" style={styles.button} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.md,
    minWidth: 160,
  },
});
