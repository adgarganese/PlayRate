import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PhoneInput, PhoneInputRef } from '@/components/PhoneInput';
import { OtpInput } from '@/components/OtpInput';
import { PlayRatePlaceholder } from '@/components/PlayRatePlaceholder';
import { useThemeColors } from '@/contexts/theme-context';
import { useResendTimer } from '@/hooks/use-resend-timer';
import { Spacing, Typography } from '@/constants/theme';
import { FEATURE_PHONE_AUTH } from '@/constants/features';
import { track } from '@/lib/analytics';

type AuthMethod = 'email' | 'phone';

export default function SignInScreen() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [, setOtp] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  
  const { signIn, signInWithPhone, verifyPhoneOtp } = useAuth();
  const { colors } = useThemeColors();
  const router = useRouter();
  const phoneInputRef = useRef<PhoneInputRef>(null);
  const resendTimer = useResendTimer({ initialSeconds: 30 });

  const handleEmailSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      setLoading(false);

      if (error) {
        let friendlyMessage = error.message;
        if (error.message.includes('Invalid login credentials')) {
          friendlyMessage = 'Email or password is incorrect. Please try again.';
        } else if (error.message.includes('Email not confirmed')) {
          friendlyMessage = 'Please check your email and confirm your account first.';
        }
        Alert.alert('Sign In', friendlyMessage);
      } else {
        track('login_completed', { method: 'email' });
        router.replace('/(tabs)');
      }
    } catch (err) {
      setLoading(false);
      if (__DEV__) console.warn('[SignIn] signIn threw', err);
      Alert.alert('Sign In', err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    }
  };

  const handlePhoneSendCode = async () => {
    setPhoneError('');
    
    if (!phoneInputRef.current) {
      setPhoneError('Phone input error');
      return;
    }

    const e164Phone = phoneInputRef.current.getE164Format();
    
    // Validate phone number
    if (!phone || phone.replace(/\D/g, '').length < 10) {
      setPhoneError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    const { error } = await signInWithPhone(e164Phone);
    setLoading(false);

    if (error) {
      let friendlyMessage = error.message;
      if (error.message.includes('invalid')) {
        friendlyMessage = 'Please enter a valid phone number';
      } else if (error.message.includes('rate limit')) {
        friendlyMessage = 'Too many requests. Please wait a moment and try again.';
      }
      setPhoneError(friendlyMessage);
    } else {
      setShowOtpInput(true);
      resendTimer.start();
      Alert.alert('Code Sent', 'Please check your phone for the verification code.');
    }
  };

  const handlePhoneVerify = async (enteredOtp: string) => {
    if (!FEATURE_PHONE_AUTH) return;
    
    setOtpError('');
    
    if (!phoneInputRef.current) {
      setOtpError('Phone input error');
      return;
    }

    const e164Phone = phoneInputRef.current.getE164Format();

    setLoading(true);
    const { error } = await verifyPhoneOtp(e164Phone, enteredOtp);
    setLoading(false);

    if (error) {
      let friendlyMessage = error.message;
      if (error.message.includes('invalid') || error.message.includes('expired')) {
        friendlyMessage = 'Invalid or expired code. Please try again.';
      }
      setOtpError(friendlyMessage);
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleResendCode = async () => {
    if (resendTimer.isActive) return;
    await handlePhoneSendCode();
  };

  const resetPhoneFlow = () => {
    setShowOtpInput(false);
    setOtp('');
    setOtpError('');
    setPhoneError('');
    resendTimer.reset();
  };

  // Force email auth if phone auth is disabled
  useEffect(() => {
    if (!FEATURE_PHONE_AUTH) {
      if (authMethod === 'phone') {
        setAuthMethod('email');
        resetPhoneFlow();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authMethod]);

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
        <View style={styles.logoContainer}>
          <PlayRatePlaceholder />
        </View>

        <Header
          title="Sign In"
          subtitle="Welcome back"
          showBack={false}
        />

        {FEATURE_PHONE_AUTH && (
          <SegmentedControl
            options={['Email', 'Phone']}
            selectedIndex={authMethod === 'email' ? 0 : 1}
            onSelect={(index) => {
              setAuthMethod(index === 0 ? 'email' : 'phone');
              resetPhoneFlow();
            }}
          />
        )}

        <View style={styles.form}>
          {authMethod === 'email' ? (
            <>
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

              <PasswordInput
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="password"
                editable={!loading}
              />

              <Button
                title="Sign In"
                onPress={handleEmailSignIn}
                variant="primary"
                loading={loading}
                disabled={loading}
              />
            </>
          ) : (
            <>
              {!showOtpInput ? (
                <>
                  <PhoneInput
                    ref={phoneInputRef}
                    value={phone}
                    onChangeText={setPhone}
                    error={phoneError}
                    editable={!loading}
                  />

                  <Button
                    title="Send Code"
                    onPress={handlePhoneSendCode}
                    variant="primary"
                    loading={loading}
                    disabled={loading || resendTimer.isActive}
                  />
                </>
              ) : (
                <>
                  <View style={styles.phoneDisplay}>
                    <Text style={[styles.phoneDisplayText, { color: colors.textMuted }]}>
                      Code sent to {phoneInputRef.current?.getE164Format() || phone}
                    </Text>
                    <TouchableOpacity onPress={resetPhoneFlow}>
                      <Text style={[styles.changePhoneText, { color: colors.primarySmallText }]}>Change</Text>
                    </TouchableOpacity>
                  </View>

                  <OtpInput
                    length={6}
                    onComplete={handlePhoneVerify}
                    error={otpError}
                    editable={!loading}
                  />

                  <TouchableOpacity
                    style={styles.resendButton}
                    onPress={handleResendCode}
                    disabled={resendTimer.isActive || loading}
                  >
                    <Text style={[
                      styles.resendText,
                      { color: resendTimer.isActive ? colors.textMuted : colors.primarySmallText }
                    ]}>
                      {resendTimer.isActive 
                        ? `Resend code in ${resendTimer.seconds}s` 
                        : 'Resend code'}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}

          {authMethod === 'email' && (
            <>
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push('/forgot-password')}
              >
                <Text style={[styles.linkText, { color: colors.textMuted }]}>
                  Forgot password? <Text style={[styles.linkTextBold, { color: colors.primarySmallText }]}>Reset it</Text>
                </Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push('/sign-up')}
          >
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              {`Don't have an account? `}<Text style={[styles.linkTextBold, { color: colors.primarySmallText }]}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </View>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: Spacing.xl * 2,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    paddingVertical: Spacing.lg,
    width: '100%',
    minHeight: 120,
  },
  form: {
    width: '100%',
  },
  phoneDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  phoneDisplayText: {
    ...Typography.muted,
    flex: 1,
  },
  changePhoneText: {
    ...Typography.muted,
    fontWeight: '600',
  },
  resendButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  resendText: {
    ...Typography.muted,
  },
  linkButton: {
    marginTop: Spacing.lg,
    alignItems: 'center',
  },
  linkText: {
    ...Typography.muted,
  },
  linkTextBold: {
    ...Typography.muted,
    fontWeight: '600',
  },
});
