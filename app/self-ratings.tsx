import { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { track, getOnboardingDurationSeconds } from '@/lib/analytics';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { SportAttributesRatingSection } from '@/components/SportAttributesRatingSection';
import { useSelfRatingsForSport } from '@/hooks/use-self-ratings-for-sport';
import {
  fetchProfileSportsForRatings,
  fetchAllEnabledSports,
  type SelfRatingsSport,
} from '@/lib/self-ratings-queries';
import { logger } from '@/lib/logger';
import { UI_LOAD_FAILED } from '@/lib/user-facing-errors';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

export default function SelfRatingsScreen() {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const router = useRouter();
  const [sports, setSports] = useState<SelfRatingsSport[]>([]);
  const [selectedSport, setSelectedSport] = useState<SelfRatingsSport | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    attributes,
    ratings,
    draftRatings,
    loading: loadingSport,
    saving,
    ratingButtonSize,
    ratingButtonFontSize,
    ratingButtonGap,
    attributeEditabilityMap,
    attributeUnlockDateMap,
    handleRating,
    hasUnsavedChanges,
    saveDraftRatings,
  } = useSelfRatingsForSport(user?.id, selectedSport, { onboardingMode: false });

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        router.replace('/sign-in');
      }, 100);
      return () => clearTimeout(timer);
    }
    void loadSports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSports = async () => {
    if (!user) return;

    const fromProfile = await fetchProfileSportsForRatings(user.id);
    if (fromProfile.length > 0) {
      setSports(fromProfile);
      setLoading(false);
      return;
    }

    try {
      const all = await fetchAllEnabledSports();
      setSports(all);
    } catch (e) {
      if (__DEV__) logger.warn('[self-ratings] load sports failed', { err: e });
      Alert.alert('Error', UI_LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAll = async () => {
    const res = await saveDraftRatings();
    if (!res.ok) return;

    const durationSeconds = getOnboardingDurationSeconds();
    track('onboarding_completed', { duration_seconds: durationSeconds ?? undefined });

    if (res.count > 0) {
      Alert.alert(
        'Saved',
        `Your ${res.count} rating${res.count > 1 ? 's have' : ' has'} been saved!`
      );
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Self Ratings"
          subtitle="Rate yourself on sport-specific attributes (1-10 scale)"
          showBack={false}
        />
        {sports.length === 0 ? (
          <Card>
            <EmptyState
              title="Select the sports you play first, then rate your skills."
              actionLabel="Choose Sports"
              onAction={() => router.push('/my-sports')}
            />
          </Card>
        ) : (
          <>
            <View style={styles.section}>
              <SectionTitle>Select Sport</SectionTitle>
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

            {selectedSport && (
              <View style={styles.section}>
                <SectionTitle>{selectedSport.name} Attributes</SectionTitle>
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
                    ratingButtonSize={ratingButtonSize}
                    ratingButtonFontSize={ratingButtonFontSize}
                    ratingButtonGap={ratingButtonGap}
                    saving={saving}
                    onRatingPress={(id, v) => void handleRating(id, v)}
                    hasUnsavedChanges={hasUnsavedChanges}
                    onSavePress={() => void handleSaveAll()}
                  />
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {},
  section: {
    marginBottom: Spacing.xl,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  sportButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
  loadingInline: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
});
