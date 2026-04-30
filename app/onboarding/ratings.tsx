import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/AppText';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { SportAttributesRatingSection } from '@/components/SportAttributesRatingSection';
import { useSelfRatingsForSport } from '@/hooks/use-self-ratings-for-sport';
import { fetchProfileSportsForRatings, type SelfRatingsSport } from '@/lib/self-ratings-queries';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';
import { logger } from '@/lib/logger';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

export default function OnboardingRatingsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [sports, setSports] = useState<SelfRatingsSport[]>([]);
  const [selectedSport, setSelectedSport] = useState<SelfRatingsSport | null>(null);
  const [loadingList, setLoadingList] = useState(true);

  const {
    attributes,
    ratings,
    draftRatings,
    loading: loadingSport,
    saving,
    attributeEditabilityMap,
    attributeUnlockDateMap,
    handleRating,
    hasUnsavedChanges,
    saveDraftRatings,
  } = useSelfRatingsForSport(user?.id, selectedSport, { onboardingMode: true });

  const loadSports = useCallback(async () => {
    if (!user?.id) return;
    setLoadingList(true);
    try {
      const list = await fetchProfileSportsForRatings(user.id);
      setSports(list);
      if (list.length === 0) {
        router.replace('/onboarding/courts' as any);
      }
    } catch (e) {
      if (__DEV__) logger.warn('[onboarding/ratings] load sports', { err: e });
      Alert.alert('Error', 'Could not load your sports. You can continue and rate later in Self Ratings.');
      router.replace('/onboarding/courts' as any);
    } finally {
      setLoadingList(false);
    }
  }, [user?.id, router]);

  useEffect(() => {
    if (!user) {
      const t = setTimeout(() => router.replace('/sign-in'), 100);
      return () => clearTimeout(t);
    }
    void loadSports();
  }, [user, loadSports, router]);

  const goCourts = () => router.push('/onboarding/courts' as any);

  const persistThenCourts = async () => {
    if (hasUnsavedChanges()) {
      const res = await saveDraftRatings();
      if (!res.ok) return;
    }
    goCourts();
  };

  const skipButton = (
    <TouchableOpacity
      onPress={() => void persistThenCourts()}
      disabled={saving}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Skip ratings and continue"
    >
      <AppText variant="muted" color="primary" style={styles.skipLabel}>
        Skip
      </AppText>
    </TouchableOpacity>
  );

  if (loadingList) {
    return <LoadingScreen message="Loading..." />;
  }
  if (sports.length === 0) {
    return <LoadingScreen message="Continuing…" />;
  }

  return (
    <Screen>
      <Header
        title="Rate your game"
        subtitle="Tap a score from 1–10 for each skill. You can update these later in Self Ratings."
        showBack={false}
        rightElement={skipButton}
      />
      <OnboardingProgress current={2} total={5} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <SectionTitle>Select sport</SectionTitle>
          <View style={styles.sportGrid}>
            {sports.map((sport) => (
              <Button
                key={sport.id}
                title={sport.name}
                onPress={() => setSelectedSport(sport)}
                variant={selectedSport?.id === sport.id ? 'primary' : 'secondary'}
                style={styles.sportButton}
              />
            ))}
          </View>
        </View>

        {selectedSport ? (
          <View style={styles.section}>
            <SectionTitle>{selectedSport.name} attributes</SectionTitle>
            {loadingSport ? (
              <View style={styles.loadingInline}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <SportAttributesRatingSection
                sportName={selectedSport.name}
                attributes={attributes}
                ratings={ratings}
                draftRatings={draftRatings}
                attributeEditabilityMap={attributeEditabilityMap}
                attributeUnlockDateMap={attributeUnlockDateMap}
                saving={saving}
                onRatingPress={(id, v) => void handleRating(id, v)}
                hasUnsavedChanges={hasUnsavedChanges}
                onSavePress={() => void persistThenCourts()}
                showSaveButton={false}
              />
            )}
          </View>
        ) : (
          <Card>
            <EmptyState title="Pick a sport above to rate your attributes." />
          </Card>
        )}

        <Button
          title="Next"
          onPress={() => void persistThenCourts()}
          variant="primary"
          style={styles.next}
          loading={saving}
          disabled={saving}
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
  sportButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  loadingInline: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  next: { marginTop: Spacing.md },
});
