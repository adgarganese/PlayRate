import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

export default function ResetPasswordScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useThemeColors();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifyAndSetSession = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          setError('Failed to verify reset link. Please request a new one.');
          setVerifying(false);
          return;
        }
        
        if (session) {
          setVerifying(false);
          return;
        }
        
        const accessToken = params.access_token as string | undefined;
        const refreshToken = params.refresh_token as string | undefined;
        const type = params.type as string | undefined;
        
        if (type === 'recovery' && accessToken && refreshToken) {
          const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (setSessionError) {
            setError('Invalid or expired reset link. Please request a new one.');
            setVerifying(false);
            return;
          }
          
          if (sessionData?.session) {
            setVerifying(false);
            return;
          }
        }
        
        const { data: { session: finalSession } } = await supabase.auth.getSession();
        if (!finalSession) {
          setError('No valid reset session found. Please request a new password reset link.');
          setVerifying(false);
          return;
        }
        
        setVerifying(false);
      } catch (error) {
        if (__DEV__) console.warn('[reset-password:verify]', error);
        setError('An error occurred. Please try again.');
        setVerifying(false);
      }
    };

    verifyAndSetSession();
  }, [params]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (updateError) {
      let friendlyMessage = updateError.message;
      if (updateError.message.includes('expired') || updateError.message.includes('invalid')) {
        friendlyMessage = 'This reset link has expired. Please request a new one.';
      }
      Alert.alert('Error', friendlyMessage);
    } else {
      Alert.alert(
        'Password Reset',
        'Your password has been updated! You can now sign in.',
        [
          {
            text: 'Sign In',
            onPress: () => router.replace('/sign-in'),
          },
        ]
      );
    }
  };

  if (verifying) {
    return (
      <KeyboardScreen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Verifying reset link...</Text>
        </View>
      </KeyboardScreen>
    );
  }

  if (error) {
    return (
      <KeyboardScreen contentContainerStyle={styles.scrollContent}>
          <Header title="Error" showBack={false} />
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.text }]}>{error}</Text>
            <Button
              title="Request New Link"
              onPress={() => router.replace('/forgot-password')}
              variant="primary"
            />
          </View>
      </KeyboardScreen>
    );
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Header
          title="Reset Password"
          subtitle="Enter your new password below."
          showBack={false}
        />

        <View style={styles.form}>
          <TextInput
            label="New Password"
            placeholder="Enter new password (min 6 characters)"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
          />

          <TextInput
            label="Confirm Password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="password-new"
            editable={!loading}
          />

          <Button
            title="Reset Password"
            onPress={handleResetPassword}
            variant="primary"
            loading={loading}
            disabled={loading}
          />
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  form: {
    width: '100%',
  },
  errorContainer: {
    marginBottom: Spacing.xl,
  },
  errorText: {
    ...Typography.body,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
});
