import { TextInput, Text, StyleSheet, TextInputProps, View } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type InputProps = TextInputProps & {
  label?: string;
  error?: string;
};

export function Input({ label, error, style, ...props }: InputProps) {
  const { colors } = useThemeColors();
  
  return (
    <View style={styles.container}>
      {label && <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: error ? '#FF6B6B' : colors.border,
            color: colors.text,
          },
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        {...props}
      />
      {error && <Text style={[styles.errorText, { color: '#FF6B6B' }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.mutedSmall,
    marginTop: Spacing.xs,
  },
});
