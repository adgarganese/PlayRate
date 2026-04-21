import { TextInput as RNTextInput, StyleSheet, Text, TextInputProps } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type CustomTextInputProps = TextInputProps & {
  label?: string;
};

export function TextInput({
  label,
  style,
  accessibilityLabel,
  ...props
}: CustomTextInputProps) {
  const { colors } = useThemeColors();

  return (
    <>
      {label && (
        <Text
          style={[styles.label, { color: colors.text }]}
          accessible={false}
          importantForAccessibility="no"
        >
          {label}
        </Text>
      )}
      <RNTextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            color: colors.text,
          },
          style,
        ]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={accessibilityLabel ?? label}
        {...props}
      />
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
});
