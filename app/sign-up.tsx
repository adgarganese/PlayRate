import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { PhoneInput, PhoneInputRef } from '@/components/PhoneInput';
import { OtpInput } from '@/components/OtpInput';
import { PlayRatePlaceholder } from '@/components/PlayRatePlaceholder';
import { AuthAmbientBackdrop } from '@/components/ui/AuthAmbientBackdrop';
import { useThemeColors } from '@/contexts/theme-context';
import { useResendTimer } from '@/hooks/use-resend-timer';
import { Spacing, Typography } from '@/constants/theme';
import { FEATURE_PHONE_AUTH } from '@/constants/features';
import { track } from '@/lib/analytics';
import {
  getRateLimitUserMessage,
  isValidEmailFormat,
  validateSignUpPassword,
  validateUsername,
} from '@/lib/auth-validation';
import { UI_GENERIC } from '@/lib/user-facing-errors';

type AuthMethod = 'email' | 'phone';

export default function SignUpScreen() {
  const [authMethod, setAuthMethod] = useState<AuthMethod>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [otpError, setOtpError] = useState('');
  
  const { signUp, signInWithPhone, verifyPhoneOtp } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const phoneInputRef = useRef<PhoneInputRef>(null);
  const resendTimer = useResendTimer({ initialSeconds: 30 });

  const handleEmailSignUp = async () => {
    if (!email || !password || !username) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const usernameErr = validateUsername(username);
    if (usernameErr) {
      Alert.alert('Error', usernameErr);
      return;
    }

    if (!isValidEmailFormat(email)) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    const pwdErr = validateSignUpPassword(password);
    if (pwdErr) {
      Alert.alert('Error', pwdErr);
      return;
    }

    setLoading(true);
    const { error } = await signUp(email, password, username);
    setLoading(false);

    if (error) {
      const rate = getRateLimitUserMessage(
        typeof error.message === 'string' ? error.message : ''
      );
      let friendlyMessage = rate ?? UI_GENERIC;
      if (!rate && typeof error.message === 'string') {
        if (error.message.includes('already registered')) {
          friendlyMessage = 'This email is already registered. Try signing in instead.';
        } else if (error.message.includes('username')) {
          friendlyMessage = 'This username is already taken. Please choose another.';
        } else if (error.message.toLowerCase().includes('password')) {
          friendlyMessage =
            'Password does not meet requirements. Use at least 8 characters with a letter and a number.';
        }
      }
      Alert.alert('Sign Up', friendlyMessage);
    } else {
      track('sign_up_completed', { method: 'email' });
      const { data: { session } } = await supabase.auth.getSession();
      let profileMessage = '';
      
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (profile) {
          profileMessage = '\n\nYour profile has been created successfully!';
        } else {
          profileMessage = '\n\nNote: Your profile will be created after you verify your email.';
        }
      } else {
        profileMessage = '\n\nYour profile will be created after you verify your email and sign in.';
      }

      Alert.alert(
        'Success',
        `Account created! Please check your email to verify your account.${profileMessage}`,
        [
          {
            text: 'OK',
            onPress: () => router.replace('/sign-in'),
          },
        ]
      );
    }
  };

  const handlePhoneSendCode = async () => {
    setPhoneError('');
    
    if (!username || username.length < 3) {
      Alert.alert('Error', 'Username must be at least 3 characters');
      return;
    }

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
      const rate = getRateLimitUserMessage(error.message);
      let friendlyMessage = rate ?? UI_GENERIC;
      if (!rate && error.message.toLowerCase().includes('invalid')) {
        friendlyMessage = 'Please enter a valid phone number';
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
    const { error } = await verifyPhoneOtp(e164Phone, enteredOtp, username);
    setLoading(false);

    if (error) {
      const rate = getRateLimitUserMessage(error.message);
      let friendlyMessage = rate ?? UI_GENERIC;
      if (
        !rate &&
        (error.message.includes('invalid') || error.message.includes('expired'))
      ) {
        friendlyMessage = 'Invalid or expired code. Please try again.';
      }
      setOtpError(friendlyMessage);
    } else {
      Alert.alert(
        'Success',
        'Account created! Your profile has been set up.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)'),
          },
        ]
      );
    }
  };

  const handleResendCode = async () => {
    if (resendTimer.isActive) return;
    await handlePhoneSendCode();
  };

  const resetPhoneFlow = () => {
    setShowOtpInput(false);
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
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <AuthAmbientBackdrop />
      <KeyboardScreen
        style={styles.keyboardTransparent}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.logoContainer}>
          <PlayRatePlaceholder />
        </View>

        <Header
          title="Sign Up"
          subtitle="Create your athlete profile"
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
          <TextInput
            label="Username"
            placeholder="Choose a username"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoComplete="username"
            editable={!loading}
          />

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
                placeholder="Min 8 characters, include a letter and a number"
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
                autoComplete="password-new"
                editable={!loading}
              />

              <Button
                title="Sign Up"
                onPress={handleEmailSignUp}
                variant="primary"
                primaryGradient
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
                    primaryGradient
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
                    <TouchableOpacity
                      onPress={resetPhoneFlow}
                      accessibilityRole="button"
                      accessibilityLabel="Change phone number"
                    >
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
                    accessibilityRole="button"
                    accessibilityLabel={
                      resendTimer.isActive
                        ? `Resend code, available in ${resendTimer.seconds} seconds`
                        : 'Resend verification code'
                    }
                    accessibilityState={{ disabled: resendTimer.isActive || loading }}
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

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
            accessibilityRole="link"
            accessibilityLabel="Sign in, already have an account"
          >
            <Text style={[styles.linkText, { color: colors.textMuted }]}>
              Already have an account? <Text style={[styles.linkTextBold, { color: colors.primarySmallText }]}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardScreen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  keyboardTransparent: {
    backgroundColor: 'transparent',
  },
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
