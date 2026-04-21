import { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { getRateLimitUserMessage, isValidEmailFormat } from '@/lib/auth-validation';
import { UI_GENERIC } from '@/lib/user-facing-errors';
import { getPasswordResetRedirectTo } from '@/lib/password-reset-redirect';

export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { colors } = useThemeColors();

  const handleSendResetEmail = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    if (!isValidEmailFormat(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);

    const redirectTo = getPasswordResetRedirectTo();
    if (__DEV__ && redirectTo.startsWith('playrate://')) {
      console.warn(
        '[forgot-password] redirectTo uses a custom URL scheme; many email clients block or ignore it. ' +
          'Set EXPO_PUBLIC_PASSWORD_RESET_REDIRECT_URL to an HTTPS URL that serves web/password-reset-bridge.html (see PASSWORD-RESET-SETUP.md).'
      );
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    setLoading(false);

    if (error) {
      const rate = getRateLimitUserMessage(error.message);
      let friendlyMessage = rate ?? UI_GENERIC;
      if (
        !rate &&
        (error.message.includes('not found') || error.message.includes('does not exist'))
      ) {
        friendlyMessage = 'No account found with this email address.';
      }
      Alert.alert('Error', friendlyMessage);
    } else {
      setEmailSent(true);
    }
  };

  if (emailSent) {
    return (
      <KeyboardScreen contentContainerStyle={styles.scrollContent}>
          <Header title="Check Your Email" showBack={false} />
          <View style={styles.messageContainer}>
            <Text style={[styles.messageText, { color: colors.text }]}>
              {`We've sent a password reset link to `}{email}
            </Text>
            <Text style={[styles.instructions, { color: colors.textMuted }]}>
              Click the link in the email to reset your password. The link will expire in 1 hour.
            </Text>
          </View>
          <Button
            title="Back to Sign In"
            onPress={() => router.back()}
            variant="primary"
          />
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Header
          title="Forgot Password"
          subtitle="Enter your email address and we'll send you a link to reset your password."
          showBack={false}
        />

        <View style={styles.form}>
          <TextInput
            label="Email"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!loading}
          />

          <Button
            title="Send Reset Link"
            onPress={handleSendResetEmail}
            variant="primary"
            loading={loading}
            disabled={loading}
          />

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel="Back to sign in"
          >
            <Text style={[styles.linkText, { color: colors.primarySmallText }]}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  /** flex-start avoids vertical centering that fights the keyboard and creates misleading scroll range */
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'flex-start',
    paddingTop: Spacing.lg,
  },
  form: {
    width: '100%',
  },
  messageContainer: {
    marginBottom: Spacing.xl,
  },
  messageText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  instructions: {
    ...Typography.muted,
    textAlign: 'center',
  },
  linkButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    ...Typography.muted,
    fontWeight: '600',
  },
});
