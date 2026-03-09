import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { getReportProblemMailtoUrl, getFeedbackFormUrl, getFeedbackContext, getPrivacyPolicyUrl, getTermsUrl } from '@/lib/feedback';
import { track } from '@/lib/analytics';

type ProfileAccount = {
  username: string | null;
  created_at: string;
};

export default function AccountScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useThemeColors();
  const [profile, setProfile] = useState<ProfileAccount | null>(null);
  const [loading, setLoading] = useState(true);

  const handleChangePassword = () => {
    router.push({ pathname: '/forgot-password', params: { email: user?.email ?? '' } } as any);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/sign-in'); } },
    ]);
  };

  const openReportProblem = () => {
    track('report_problem_tapped', {});
    const url = getReportProblemMailtoUrl({
      userId: user?.id ?? null,
      route: pathname ?? undefined,
    });
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Cannot open email',
        'Please email us at the support address from your mail app and include your device and app version.'
      );
    });
  };

  const openSendFeedback = () => {
    const { app_version, build_number } = getFeedbackContext();
    track('feedback_opened', { app_version, build_number });
    const url = getFeedbackFormUrl({ userId: user?.id ?? null });
    Linking.openURL(url).catch(() => {
      Alert.alert(
        'Cannot open',
        'Unable to open the feedback form. Please try again later.'
      );
    });
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    loadAccount();
  }, [user, authLoading]);

  const loadAccount = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username, created_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      setProfile(data || { username: null, created_at: '' });
    } catch (error) {
      if (__DEV__) console.warn('[profile-account:load]', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) return <LoadingScreen message="Loading..." />;
  if (!user) return null;

  const privacyUrl = getPrivacyPolicyUrl();
  const termsUrl = getTermsUrl();
  const { app_version, build_number } = getFeedbackContext();
  const versionBuildLabel = build_number ? `Version ${app_version} (${build_number})` : `Version ${app_version}`;

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent} paddingHorizontal={0}>
      <Header title="Account & Security" showBack />
      <Card style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Account</Text>
        <View style={[styles.section, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
          <Text style={[styles.value, { color: colors.text }]}>{user.email}</Text>
        </View>
        <View style={[styles.section, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Username</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {profile?.username ? `@${profile.username}` : '—'}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Username cannot be changed
          </Text>
        </View>
        <View style={[styles.section, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Member since</Text>
          <Text style={[styles.value, { color: colors.text }]}>
            {profile?.created_at
              ? new Date(profile.created_at).toLocaleDateString()
              : '—'}
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Security</Text>
        <Pressable
          style={({ pressed }) => [styles.section, styles.reportRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={handleChangePassword}
        >
          <Text style={[styles.reportLabel, { color: colors.primary }]}>Change password</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            We'll send a link to your email to set a new password
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Support</Text>
        <Pressable
          style={({ pressed }) => [styles.section, styles.reportRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={openReportProblem}
        >
          <Text style={[styles.reportLabel, { color: colors.primary }]}>Report a problem</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Opens email with app & device info
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.section, styles.reportRow, { opacity: pressed ? 0.7 : 1 }]}
          onPress={openSendFeedback}
        >
          <Text style={[styles.reportLabel, { color: colors.primary }]}>Send Feedback</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Opens beta feedback questionnaire
          </Text>
        </Pressable>

        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Legal & About</Text>
        {privacyUrl ? (
          <Pressable
            style={({ pressed }) => [styles.section, styles.reportRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => Linking.openURL(privacyUrl)}
          >
            <Text style={[styles.reportLabel, { color: colors.primary }]}>Privacy Policy</Text>
          </Pressable>
        ) : null}
        {termsUrl ? (
          <Pressable
            style={({ pressed }) => [styles.section, styles.reportRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => Linking.openURL(termsUrl)}
          >
            <Text style={[styles.reportLabel, { color: colors.primary }]}>Terms of Service</Text>
          </Pressable>
        ) : null}
        <View style={[styles.section, styles.reportRow]}>
          <Text style={[styles.value, { color: colors.textMuted }]}>{versionBuildLabel}</Text>
        </View>
      </Card>

      <Pressable
        style={({ pressed }) => [styles.signOutRow, { opacity: pressed ? 0.7 : 1 }]}
        onPress={handleSignOut}
      >
        <Text style={[styles.signOutLabel]}>Sign out</Text>
      </Pressable>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing.xl },
  card: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  sectionTitle: {
    ...Typography.mutedSmall,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    paddingHorizontal: 0,
  },
  section: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  label: { ...Typography.muted, marginBottom: Spacing.sm },
  value: { ...Typography.body },
  hint: { ...Typography.mutedSmall, marginTop: Spacing.xs },
  reportRow: { borderBottomWidth: 0 },
  reportLabel: { ...Typography.body, fontWeight: '600' },
  signOutRow: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  signOutLabel: { ...Typography.body, fontWeight: '600', color: '#FF3B30' },
});
