import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, Alert, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { AppText } from '@/components/ui/AppText';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { Spacing, Radius } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';
import { isSportEnabled } from '@/constants/sport-definitions';
import { logger } from '@/lib/logger';
import { UI_LOAD_FAILED } from '@/lib/user-facing-errors';
import { useOnboardingExit } from '@/hooks/use-onboarding-exit';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { hapticLight, hapticSelection } from '@/lib/haptics';

type Sport = { id: string; name: string };
type ProfileSport = { sport_id: string; sport: Sport };

export default function OnboardingSportsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { exitToHome } = useOnboardingExit();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [mySports, setMySports] = useState<ProfileSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data: sportsData, error: sportsError } = await supabase
      .from('sports')
      .select('id, name')
      .order('name');

    if (sportsError) {
      if (__DEV__) logger.warn('[onboarding/sports] load sports failed', { err: sportsError });
      Alert.alert('Error', UI_LOAD_FAILED);
      setLoading(false);
      return;
    }

    if (!sportsData?.length) {
      setAllSports([]);
      setLoading(false);
      return;
    }

    setAllSports(sportsData.filter((s) => isSportEnabled(s.name)));

    const { data: profileSportsData, error: profileSportsError } = await supabase
      .from('profile_sports')
      .select(`sport_id, sport:sports(id, name)`)
      .eq('profile_id', user.id);

    if (profileSportsError) {
      setMySports([]);
    } else {
      const formatted = (profileSportsData || []).map((ps: any) => ({
        sport_id: ps.sport_id,
        sport: ps.sport,
      }));
      setMySports(formatted);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      const t = setTimeout(() => router.replace('/sign-in'), 100);
      return () => clearTimeout(t);
    }
    void loadData();
  }, [user, loadData, router]);

  const toggleSport = async (sport: Sport) => {
    if (!user || saving) return;
    const isSelected = mySports.some((ps) => ps.sport_id === sport.id);
    if (!isSelected) hapticSelection();
    setSaving(true);

    if (isSelected) {
      const { error } = await supabase
        .from('profile_sports')
        .delete()
        .eq('profile_id', user.id)
        .eq('sport_id', sport.id);
      if (error) Alert.alert('Error', 'Unable to remove sport. Please try again.');
      else await loadData();
    } else {
      const { error } = await supabase.from('profile_sports').insert({
        profile_id: user.id,
        sport_id: sport.id,
      });
      if (error) Alert.alert('Error', 'Unable to add sport. Please try again.');
      else await loadData();
    }
    setSaving(false);
  };

  const renderSportPill = (sport: Sport, isSelected: boolean) => (
    <TouchableOpacity
      key={sport.id}
      onPress={() => void toggleSport(sport)}
      disabled={saving}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${isSelected ? 'Remove' : 'Add'} ${sport.name}`}
      accessibilityState={{ selected: isSelected, disabled: saving }}
      style={[
        styles.sportPill,
        {
          backgroundColor: isSelected ? `${colors.primary}20` : colors.surface,
          borderColor: isSelected ? colors.primary : colors.border,
        },
        saving && styles.sportPillDisabled,
      ]}
    >
      {isSelected && (
        <IconSymbol name="checkmark.circle.fill" size={16} color={colors.primary} />
      )}
      <AppText variant="bodyBold" color="text" style={styles.sportPillLabel}>
        {sport.name}
      </AppText>
    </TouchableOpacity>
  );

  const skipButton = (
    <TouchableOpacity
      onPress={() => {
        hapticLight();
        void exitToHome();
      }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Skip onboarding"
    >
      <AppText variant="muted" color="primary" style={styles.skipLabel}>
        Skip
      </AppText>
    </TouchableOpacity>
  );

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  const mySportIds = new Set(mySports.map((ps) => ps.sport_id));
  const availableSports = allSports.filter((s) => !mySportIds.has(s.id));

  return (
    <Screen>
      <Header
        title="Build your roster"
        subtitle="Add the sports you play. You can update later."
        showBack={false}
        rightElement={skipButton}
      />
      <OnboardingProgress current={1} total={5} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {allSports.length === 0 ? (
          <Card>
            <EmptyState title="No sports available yet. Check back soon!" />
          </Card>
        ) : (
          <>
            {mySports.length > 0 && (
              <View style={styles.section}>
                <SectionTitle>Selected</SectionTitle>
                <View style={styles.sportGrid}>
                  {mySports.map((profileSport) => (
                    renderSportPill(profileSport.sport, true)
                  ))}
                </View>
              </View>
            )}
            {availableSports.length > 0 && (
              <View style={styles.section}>
                <SectionTitle>{mySports.length > 0 ? 'Add more' : 'Available sports'}</SectionTitle>
                <View style={styles.sportGrid}>
                  {availableSports.map((sport) => (
                    renderSportPill(sport, false)
                  ))}
                </View>
              </View>
            )}
          </>
        )}
        <Button
          title="Continue"
          onPress={() => {
            hapticLight();
            router.push('/onboarding/ratings' as any);
          }}
          variant="primary"
          style={styles.next}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipLabel: { paddingTop: 4 },
  scroll: {},
  section: { marginBottom: Spacing.xl },
  sportGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  sportPill: {
    minHeight: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sportPillDisabled: {
    opacity: 0.6,
  },
  sportPillLabel: {
    includeFontPadding: false,
  },
  next: { marginTop: Spacing.md },
});
