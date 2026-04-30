import { useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/auth-context';
import { setProfileTermsAccepted } from '@/lib/onboarding-profile';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { track } from '@/lib/analytics';

export default function TermsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const scrollBottom = useScrollContentBottomPadding('default');
  const [submitting, setSubmitting] = useState(false);

  const onAgree = async () => {
    if (!user?.id) {
      router.replace('/sign-in');
      return;
    }
    setSubmitting(true);
    const ok = await setProfileTermsAccepted(user.id);
    setSubmitting(false);
    if (!ok) {
      Alert.alert('Could not save', 'Check your connection and try again.');
      return;
    }
    track('terms_accepted', { source: 'beta_gate' });
    router.replace('/');
  };

  return (
    <Screen contentContainerStyle={styles.screenInner}>
      <Header title="PlayRate — Beta" subtitle="Terms & privacy (summary)" showBack={false} />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottom + Spacing.xxl }]}
        showsVerticalScrollIndicator
      >
        <AppText variant="bodyBold" color="text" style={styles.block}>
          This is a beta version. Features may change and data may be reset.
        </AppText>

        <AppText variant="h3" color="text" style={styles.heading}>
          Acceptable use
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          Be respectful. No harassment, threats, hate, or abuse toward other people. Do not use PlayRate to break the
          law or to spam others.
        </AppText>

        <AppText variant="h3" color="text" style={styles.heading}>
          Your content
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          You are responsible for content you post (for example highlights, comments, and court photos). Do not post
          illegal material or content you do not have the right to share.
        </AppText>

        <AppText variant="h3" color="text" style={styles.heading}>
          Confidentiality and intellectual property
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          PlayRate is provided to you as a beta tester for testing and feedback purposes only. The PlayRate name,
          design, features, and underlying concepts are the proprietary intellectual property of the founder.
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          By accepting these terms, you agree not to copy, reproduce, reverse engineer, or use any part of the PlayRate
          product, design, or concept to build a competing product. PlayRate™ is a trademark of the founder, and a
          federal trademark application is pending.
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          Confidential information you encounter during the beta — including unreleased features, internal designs, and
          beta-tester-only content — must not be shared publicly without written consent.
        </AppText>

        <AppText variant="h3" color="text" style={styles.heading}>
          Privacy (summary)
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          We collect information you provide for your profile (such as name, username, and bio), location when you use
          court features, and media you upload (such as highlights). Data is stored with our backend provider (Supabase)
          and used to run the app and improve the beta experience.
        </AppText>
        <AppText variant="body" color="textMuted" style={styles.paragraph}>
          We do not sell your personal information to third parties. Crash or usage analytics may be used to fix bugs
          and understand product usage; see your device or store settings to limit tracking where applicable.
        </AppText>

        <AppText variant="mutedSmall" color="textMuted" style={styles.disclaimer}>
          This screen is a plain-language summary for beta testers, not a substitute for professional legal advice.
        </AppText>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, Spacing.md) + Spacing.sm,
          },
        ]}
      >
        <Button
          title={submitting ? 'Saving…' : 'I Agree'}
          onPress={() => void onAgree()}
          variant="primary"
          loading={submitting}
          disabled={submitting}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenInner: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: Spacing.md,
  },
  block: {
    marginBottom: Spacing.lg,
    lineHeight: 24,
  },
  heading: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  paragraph: {
    marginBottom: Spacing.sm,
    lineHeight: 22,
  },
  disclaimer: {
    marginTop: Spacing.lg,
    lineHeight: 18,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.md,
  },
});
