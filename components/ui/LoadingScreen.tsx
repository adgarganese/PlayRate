import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Screen } from './Screen';
import { AppText } from './AppText';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';

type LoadingScreenProps = {
  message?: string;
};

export function LoadingScreen({ message = 'Loading...' }: LoadingScreenProps) {
  const { colors } = useThemeColors();
  return (
    <Screen>
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
  text: {
    textAlign: 'center',
  },
});
