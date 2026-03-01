import { useEffect, useState } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { trackOnce, setOnboardingStartedAt } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spacing } from '@/constants/theme';
import { isSportEnabled } from '@/constants/sport-definitions';

type Sport = {
  id: string;
  name: string;
};

type ProfileSport = {
  sport_id: string;
  sport: Sport;
};

export default function MySportsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [allSports, setAllSports] = useState<Sport[]>([]);
  const [mySports, setMySports] = useState<ProfileSport[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        router.replace('/sign-in');
      }, 100);
      return () => clearTimeout(timer);
    }
    setOnboardingStartedAt(Date.now());
    trackOnce('onboarding_started', 'my-sports-session');
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    setLoading(true);

    const { data: sportsData, error: sportsError } = await supabase
      .from('sports')
      .select('id, name')
      .order('name');

    if (sportsError) {
      Alert.alert('Error', `Failed to load sports: ${sportsError.message}`);
      setLoading(false);
      return;
    }

    if (!sportsData || sportsData.length === 0) {
      setAllSports([]);
      setLoading(false);
      return;
    }

    setAllSports(sportsData.filter((s) => isSportEnabled(s.name)));

    const { data: profileSportsData, error: profileSportsError } = await supabase
      .from('profile_sports')
      .select(`
        sport_id,
        sport:sports(id, name)
      `)
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
  };

  const toggleSport = async (sport: Sport) => {
    if (!user || saving) return;

    const isSelected = mySports.some((ps) => ps.sport_id === sport.id);

    setSaving(true);

    if (isSelected) {
      const { error } = await supabase
        .from('profile_sports')
        .delete()
        .eq('profile_id', user.id)
        .eq('sport_id', sport.id);

      if (error) {
        Alert.alert('Error', 'Unable to remove sport. Please try again.');
      } else {
        await loadData();
      }
    } else {
      const { error } = await supabase
        .from('profile_sports')
        .insert({
          profile_id: user.id,
          sport_id: sport.id,
        });

      if (error) {
        Alert.alert('Error', 'Unable to add sport. Please try again.');
      } else {
        await loadData();
      }
    }

    setSaving(false);
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  const mySportIds = new Set(mySports.map((ps) => ps.sport_id));
  const availableSports = allSports.filter((s) => !mySportIds.has(s.id));

  return (
    <Screen>
      <Header
        title="My Sports"
        subtitle="Select the sports you play. You can rate yourself on attributes for these sports."
        showBack={false}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {allSports.length === 0 ? (
          <Card>
            <EmptyState
              title="No sports available yet. Check back soon!"
            />
          </Card>
        ) : (
          <>
            {mySports.length > 0 && (
              <View style={styles.section}>
                <SectionTitle>Selected Sports</SectionTitle>
                <View style={styles.sportGrid}>
                  {mySports.map((profileSport) => (
                    <Button
                      key={profileSport.sport_id}
                      title={`${profileSport.sport.name} ✓`}
                      onPress={() => toggleSport(profileSport.sport)}
                      variant="primary"
                      size="medium"
                      disabled={saving}
                      style={styles.sportButton}
                    />
                  ))}
                </View>
              </View>
            )}

            {availableSports.length > 0 && (
              <View style={styles.section}>
                <SectionTitle>
                  {mySports.length > 0 ? 'Add More Sports' : 'Select Sports'}
                </SectionTitle>
                <View style={styles.sportGrid}>
                  {availableSports.map((sport) => (
                    <Button
                      key={sport.id}
                      title={`+ ${sport.name}`}
                      onPress={() => toggleSport(sport)}
                      variant="secondary"
                      disabled={saving}
                      style={styles.sportButton}
                    />
                  ))}
                </View>
              </View>
            )}

            {mySports.length === 0 && availableSports.length === 0 && (
              <Card>
                <EmptyState
                  title="You've selected all available sports! Ready to rate your skills?"
                />
              </Card>
            )}
          </>
        )}

        {mySports.length > 0 && (
          <Button
            title="Rate Myself on My Sports"
            onPress={() => router.push('/self-ratings')}
            variant="primary"
            style={styles.actionButton}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  sportButton: {
    // Size handled by Button component
  },
  actionButton: {
    marginTop: Spacing.md,
  },
});
