import { useState } from 'react';
import { TextInput as RNTextInput, StyleSheet, Text, View, Pressable, TextInputProps, ViewStyle } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Spacing, Radius, Typography } from '@/constants/theme';

const ICON_SIZE = 22;
const INPUT_PADDING_RIGHT = Spacing.md + ICON_SIZE + Spacing.sm;

type PasswordInputProps = TextInputProps & {
  label?: string;
  containerStyle?: ViewStyle;
};

export function PasswordInput({
  label,
  containerStyle,
  style,
  editable = true,
  accessibilityLabel,
  ...props
}: PasswordInputProps) {
  const { colors } = useThemeColors();
  const [showPassword, setShowPassword] = useState(false);

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
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          containerStyle,
        ]}
      >
        <RNTextInput
          style={[
            styles.input,
            {
              color: colors.text,
              paddingRight: INPUT_PADDING_RIGHT,
            },
            style,
          ]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={!showPassword}
          editable={editable}
          accessibilityLabel={accessibilityLabel ?? label}
          {...props}
        />
        <Pressable
          style={styles.eyeButton}
          onPress={() => setShowPassword((prev) => !prev)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          accessibilityRole="button"
        >
          <IconSymbol
            name={showPassword ? 'eye.slash.fill' : 'eye.fill'}
            size={ICON_SIZE}
            color={colors.textMuted}
          />
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    marginBottom: Spacing.lg,
  },
  input: {
    ...Typography.body,
    flex: 1,
    padding: Spacing.md,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.sm,
    padding: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
