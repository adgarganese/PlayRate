import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { mergeQueryAndHash } from '@/lib/parse-auth-url';
import { useThemeColors } from '@/contexts/theme-context';

/**
 * Handles Supabase redirects: OAuth PKCE (code), implicit/session tokens, email confirmation, etc.
 * Supabase redirect URLs: `playrate://auth/callback` and, if using universal links,
 * `https://<your-host>/auth/callback` (same path your site serves; AASA on that host opens the app).
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const url = Linking.useURL();
  const { colors } = useThemeColors();
  const [message, setMessage] = useState('Signing you in…');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const {
        data: { session: existing },
      } = await supabase.auth.getSession();
      if (existing && !cancelled) {
        router.replace('/(tabs)');
        return;
      }

      let targetUrl = url ?? (await Linking.getInitialURL());
      if (!targetUrl || cancelled) {
        router.replace('/sign-in');
        return;
      }

      const p = mergeQueryAndHash(targetUrl);
      const type = p.type;

      if (type === 'recovery' && p.access_token && p.refresh_token) {
        const { error } = await supabase.auth.setSession({
          access_token: p.access_token,
          refresh_token: p.refresh_token,
        });
        if (error || cancelled) {
          if (!cancelled) router.replace('/sign-in');
          return;
        }
        if (!cancelled) router.replace('/reset-password');
        return;
      }

      try {
        if (p.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(p.code);
          if (error) throw error;
        } else if (p.access_token && p.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: p.access_token,
            refresh_token: p.refresh_token,
          });
          if (error) throw error;
        } else {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          if (!session) {
            if (!cancelled) {
              setMessage('Invalid or expired sign-in link.');
              setTimeout(() => router.replace('/sign-in'), 2000);
            }
            return;
          }
        }
      } catch {
        if (!cancelled) router.replace('/sign-in');
        return;
      }

      if (!cancelled) router.replace('/(tabs)');
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [url, router]);

  return (
    <View style={[styles.box, { backgroundColor: colors.bg }]}>
      <ActivityIndicator color={colors.primary} />
      <Text style={[styles.txt, { color: colors.textMuted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  txt: { fontSize: 14 },
});
