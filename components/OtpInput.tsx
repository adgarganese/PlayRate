import { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Text } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type OtpInputProps = {
  length?: number;
  onComplete: (otp: string) => void;
  error?: string;
  editable?: boolean;
};

export function OtpInput({
  length = 6,
  onComplete,
  error,
  editable = true,
}: OtpInputProps) {
  const { colors } = useThemeColors();
  const [otp, setOtp] = useState<string[]>(Array(length).fill(''));
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Only allow single digit
    if (text.length > 1) {
      text = text[text.length - 1];
    }

    // Only allow numbers
    if (text && !/^\d$/.test(text)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);

    // Auto-advance to next input
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Check if all digits are filled
    const otpString = newOtp.join('');
    if (otpString.length === length) {
      onComplete(otpString);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Handle backspace - move to previous input if current is empty
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    // Select all text when focusing
    inputRefs.current[index]?.setNativeProps({ selection: { start: 0, end: 1 } });
  };

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>Enter Verification Code</Text>
      <View style={styles.container}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.input,
              {
                backgroundColor: colors.surface,
                borderColor: error ? '#FF0000' : colors.border,
                color: colors.text,
              },
              digit && {
                borderColor: colors.primary,
                borderWidth: 2,
              },
            ]}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            keyboardType="number-pad"
            maxLength={1}
            selectTextOnFocus
            editable={editable}
          />
        ))}
      </View>
      {error && (
        <Text style={[styles.errorText, { color: '#FF0000' }]}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderRadius: Radius.sm,
    ...Typography.h2,
    textAlign: 'center',
    minHeight: 56,
  },
  errorText: {
    ...Typography.mutedSmall,
    marginTop: -Spacing.md,
    marginBottom: Spacing.sm,
  },
});
