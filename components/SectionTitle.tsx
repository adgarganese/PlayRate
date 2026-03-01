import { Text, StyleSheet } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Typography, Spacing } from '@/constants/theme';

type SectionTitleProps = {
  children: React.ReactNode;
};

export function SectionTitle({ children }: SectionTitleProps) {
  const { colors } = useThemeColors();
  
  return (
    <Text style={[styles.title, { color: colors.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    ...Typography.h3,
    marginBottom: Spacing.md,
  },
});
