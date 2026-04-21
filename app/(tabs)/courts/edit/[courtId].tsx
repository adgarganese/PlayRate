import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { fetchCourtById, type Court } from '@/lib/courts-api';
import { getCanDirectEditCourt } from '@/lib/court-permissions';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

/** Placeholder screen: no fields to save yet. Only creator or staff can open (matches RLS). */
export default function CourtEditPlaceholderScreen() {
  const rawId = useLocalSearchParams<{ courtId?: string | string[] }>().courtId;
  const courtId =
    rawId == null ? undefined : Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [court, setCourt] = useState<Court | null>(null);
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!courtId || !user?.id) {
        setLoading(false);
        return;
      }
      try {
        const c = await fetchCourtById(courtId);
        if (cancelled) return;
        setCourt(c);
        setAllowed(await getCanDirectEditCourt(user.id, c));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courtId, user?.id]);

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!courtId || !court || !allowed) {
    return <Redirect href={courtId ? `/courts/${courtId}` : '/courts'} />;
  }

  return (
    <Screen>
      <Header title="Edit court" />
      <View style={styles.body}>
        <Card style={{ ...styles.card, borderColor: colors.border, backgroundColor: colors.surface }}>
          <Text style={[styles.title, { color: colors.text }]}>{court.name}</Text>
          <Text style={[styles.copy, { color: colors.textMuted }]}>
            You cannot change court details from this screen yet—there is no save action. When in-app editing
            ships, saving will be limited to the court creator and staff (enforced in the database).
          </Text>
          <Button title="Back to court" variant="primary" onPress={() => router.back()} style={styles.btn} />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    padding: Spacing.lg,
  },
  card: {
    padding: Spacing.lg,
    borderWidth: 1,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.md,
  },
  copy: {
    ...Typography.body,
    marginBottom: Spacing.lg,
  },
  btn: {
    marginTop: Spacing.sm,
  },
});
