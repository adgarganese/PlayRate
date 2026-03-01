import { useState, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type PhoneInputProps = {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  editable?: boolean;
};

export type PhoneInputRef = {
  getE164Format: () => string;
};

// Simple country code selector - supports US (+1) and can be extended
const COUNTRY_CODES = [
  { code: '+1', country: 'US', flag: '🇺🇸' },
  // Add more countries as needed
];

const PhoneInputComponent = forwardRef<PhoneInputRef, PhoneInputProps>(({
  value,
  onChangeText,
  error,
  editable = true,
}, ref) => {
  const { colors } = useThemeColors();
  const [countryCode] = useState('+1');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  // Normalize phone number - remove non-numeric characters except +
  const handlePhoneChange = (text: string) => {
    // Remove all non-numeric characters
    const cleaned = text.replace(/[^\d]/g, '');
    onChangeText(cleaned);
  };

  // Format phone number for display (US format: (XXX) XXX-XXXX)
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  };

  // Get E.164 format for Supabase
  const getE164Format = (): string => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) return '';
    return `${countryCode}${cleaned}`;
  };

  useImperativeHandle(ref, () => ({
    getE164Format,
  }));

  const displayValue = formatPhoneNumber(value);

  return (
    <View>
      <Text style={[styles.label, { color: colors.text }]}>Phone Number</Text>
      <View style={[styles.container, { borderColor: error ? '#FF0000' : colors.border }]}>
        <TouchableOpacity
          style={[
            styles.countryCodeButton,
            { 
              backgroundColor: colors.surfaceAlt,
              borderRightWidth: 1,
              borderRightColor: colors.border,
            }
          ]}
          onPress={() => setShowCountryPicker(!showCountryPicker)}
          disabled={!editable}
        >
          <Text style={[styles.countryCodeText, { color: colors.text }]}>
            {COUNTRY_CODES.find(c => c.code === countryCode)?.flag} {countryCode}
          </Text>
        </TouchableOpacity>
        <TextInput
          style={[styles.input, { color: colors.text }]}
          value={displayValue}
          onChangeText={handlePhoneChange}
          placeholder="(555) 123-4567"
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          maxLength={14} // (XXX) XXX-XXXX format
          editable={editable}
        />
      </View>
      {error && (
        <Text style={[styles.errorText, { color: '#FF0000' }]}>{error}</Text>
      )}
    </View>
  );
});
PhoneInputComponent.displayName = 'PhoneInput';

export const PhoneInput = PhoneInputComponent;

const styles = StyleSheet.create({
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  container: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: Radius.sm,
    marginBottom: Spacing.lg,
    overflow: 'hidden',
  },
  countryCodeButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countryCodeText: {
    ...Typography.bodyBold,
  },
  input: {
    flex: 1,
    ...Typography.body,
    padding: Spacing.md,
  },
  errorText: {
    ...Typography.mutedSmall,
    marginTop: -Spacing.md,
    marginBottom: Spacing.sm,
  },
});

// Export helper function
export function normalizeToE164(phone: string, countryCode: string = '+1'): string {
  const cleaned = phone.replace(/\D/g, '');
  if (!cleaned) return '';
  return `${countryCode}${cleaned}`;
}
