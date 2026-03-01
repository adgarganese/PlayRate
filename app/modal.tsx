import { StyleSheet, Text } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { useThemeColors } from '@/contexts/theme-context';
import { Typography } from '@/constants/theme';

// Possibly unused: no router.push('/modal') in app; Expo template placeholder.
export default function ModalScreen() {
  const { colors } = useThemeColors();
  
  return (
    <Screen>
      <Header title="Modal" showBack={false} />
      <Text style={[styles.text, { color: colors.text }]}>This is a modal</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  text: {
    ...Typography.body,
  },
});
