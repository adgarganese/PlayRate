import { TextInput as RNTextInput, StyleSheet, Text, ViewStyle, TextInputProps } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type CustomTextInputProps = TextInputProps & {
  label?: string;
  containerStyle?: ViewStyle;
};

export function TextInput({
  label,
  containerStyle,
  style,
  ...props
}: CustomTextInputProps) {
  const { colors } = useThemeColors();

  return (
    <>
      {label && (
        <Text style={[styles.label, { color: colors.text }]}>
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
