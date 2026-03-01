import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Linking, Alert } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { getReportProblemMailtoUrl, getFeedbackFormUrl, getFeedbackContext } from '@/lib/feedback';
import { track } from '@/lib/analytics';

type ProfileAccount = {
  username: string | null;
  created_at: string;
};

export default function AccountScreen() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useThemeColors();
  const [profile, setProfile] = useState<ProfileAccount | null>(null);
  const [loading, setLoading] = useState(true);

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

  return (
    <Screen>
      <Header title="Account & Security" showBack />
      <Card style={styles.card}>
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
        <Pressable
          style={({ pressed }) => {
            const opacityStyle = { opacity: pressed ? 0.7 : 1 };
            return [styles.section, styles.reportRow, opacityStyle];
          }}
          onPress={openReportProblem}
        >
          <Text style={[styles.reportLabel, { color: colors.primary }]}>Report a problem</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Opens email with app & device info
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => {
            const opacityStyle = { opacity: pressed ? 0.7 : 1 };
            return [styles.section, styles.reportRow, opacityStyle];
          }}
          onPress={openSendFeedback}
        >
          <Text style={[styles.reportLabel, { color: colors.primary }]}>Send Feedback</Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Opens beta feedback questionnaire
          </Text>
        </Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: Spacing.lg, marginTop: Spacing.md },
  section: {
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  label: { ...Typography.muted, marginBottom: Spacing.sm },
  value: { ...Typography.body },
  hint: { ...Typography.mutedSmall, marginTop: Spacing.xs },
  reportRow: { borderBottomWidth: 0 },
  reportLabel: { ...Typography.body, fontWeight: '600' },
});
