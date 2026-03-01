import { useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const router = useRouter();
  const { colors } = useThemeColors();

  const handleSendResetEmail = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    
    let redirectUrl: string;
    if (Platform.OS === 'web') {
      redirectUrl = 'http://localhost:8081/reset-password';
    } else {
      redirectUrl = 'athleteapp://reset-password';
    }
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    setLoading(false);

    if (error) {
      let friendlyMessage = error.message;
      if (error.message.includes('not found') || error.message.includes('does not exist')) {
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
          >
            <Text style={[styles.linkText, { color: colors.primarySmallText }]}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
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
