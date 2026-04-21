import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, Modal, TouchableOpacity, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/auth-context';
import AttributeRow from '@/components/attribute-row';
import { playInitialBuzz } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { SectionTitle } from '@/components/SectionTitle';
import { AppText } from '@/components/ui/AppText';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { isSportEnabled } from '@/constants/sport-definitions';
import { useFollow } from '@/hooks/useFollow';
import { MessageButton } from '@/components/MessageButton';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { devError } from '@/lib/logging';
import { attributeNameToSlug } from '@/lib/recap';
import { UI_GENERIC, UI_LOAD_FAILED } from '@/lib/user-facing-errors';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

type Sport = {
  id: string;
  name: string;
};

type Profile = {
  user_id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  active_sport_id: string | null;
};

type AttributeRating = {
  attribute_id: string;
  attribute_name: string;
  sport_name: string;
  rating: number;
  cosign_count: number;
  can_cosign: boolean;
  has_cosigned: boolean;
  is_cosign_pending?: boolean;
};

type CosignModalState = {
  visible: boolean;
  attributeId: string;
  attributeName: string;
  sportName: string;
};

function formatFollowerCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toLocaleString();
}

export default function AthleteDetailScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const { isFollowing, followersCount, followingCount, toggleFollow, toggleLoading } = useFollow(userId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ratings, setRatings] = useState<AttributeRating[]>([]);
  const [athleteSports, setAthleteSports] = useState<Sport[]>([]);
  const [selectedSportId, setSelectedSportId] = useState<string | null>(null);
  const [sportProfile, setSportProfile] = useState<{ play_style: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [cosignModal, setCosignModal] = useState<CosignModalState | null>(null);
  const [cosignComment, setCosignComment] = useState('');
  const [cosignError, setCosignError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isOwnProfile = !!(user && userId && user.id === userId);

  useEffect(() => {
    if (userId) loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (selectedSportId) {
      loadSportProfile(selectedSportId);
      loadRatingsForSport(selectedSportId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSportId, userId]);

  const loadProfile = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch profile with active_sport_id (may not exist if migration not run)
      let profileData: Profile | null = null;

      // Try with active_sport_id first
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, active_sport_id')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        devError('AthleteProfile', 'Profile load error:', error);
        // If active_sport_id column doesn't exist, try without it
        if (error.message?.includes('active_sport_id') || error.message?.includes('column') || error.code === '42703') {
          const { data: dataWithoutActiveSport, error: errorWithoutActiveSport } = await supabase
            .from('profiles')
            .select('user_id, name, username, bio')
            .eq('user_id', userId)
            .maybeSingle();

          if (errorWithoutActiveSport) {
            devError('AthleteProfile', 'Profile load error (without active_sport_id):', errorWithoutActiveSport);
            setError('Unable to load this athlete\'s profile.');
            setLoading(false);
            return;
          }

          profileData = { ...dataWithoutActiveSport, active_sport_id: null } as Profile;
        } else {
          setError('Unable to load this athlete\'s profile.');
          setLoading(false);
          return;
        }
      } else {
        profileData = data as Profile;
      }

      if (!profileData) {
        setError('Athlete not found.');
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // Fetch athlete's sports
      const { data: profileSports, error: sportsError } = await supabase
        .from('profile_sports')
        .select('sport:sports(id, name)')
        .eq('profile_id', userId);

      if (sportsError) {
        devError('AthleteProfile', 'Error loading sports:', sportsError);
        setAthleteSports([]);
        // Still set selectedSportId to null if no sports
        setSelectedSportId(null);
      } else {
        // Sort sports by name client-side
        const sortedSports = (profileSports || []).slice().sort((a: any, b: any) => {
          const nameA = a.sport?.name || '';
          const nameB = b.sport?.name || '';
          return nameA.localeCompare(nameB);
        });

        const sports: Sport[] = sortedSports.map((ps: any) => ps.sport).filter(Boolean);
        const enabledSports = sports.filter((s) => isSportEnabled(s.name));
        setAthleteSports(enabledSports);

        // Determine initial selected sport (skip disabled e.g. soccer when SOCCER_ENABLED is false)
        let initialSportId = profileData.active_sport_id;
        if (initialSportId && enabledSports.length > 0) {
          const activeSport = sports.find((s) => s.id === initialSportId);
          if (activeSport && !isSportEnabled(activeSport.name)) {
            initialSportId = enabledSports[0].id;
          }
        }
        if (!initialSportId && enabledSports.length > 0) {
          initialSportId = enabledSports[0].id;
        }
        setSelectedSportId(initialSportId || null);
      }
    } catch (err: any) {
      if (__DEV__) {
        devError('AthleteProfile', 'loadProfile failed:', err);
      }
      setError(UI_LOAD_FAILED);
    } finally {
      setLoading(false);
    }
  };

  const loadSportProfile = async (sportId: string) => {
    if (!userId || !sportId) return;

    try {
      const { data, error } = await supabase
        .from('sport_profiles')
        .select('play_style')
        .eq('user_id', userId)
        .eq('sport_id', sportId)
        .maybeSingle();

      // If table doesn't exist or other error, fall back to null
      if (error) {
        // Table might not exist if migration not run
        if (error.message?.includes('sport_profiles') || error.message?.includes('column') || error.code === '42P01') {
          setSportProfile({ play_style: null });
          return;
        }
        devError('AthleteProfile', 'Error loading sport profile:', error);
      }

      setSportProfile(data || { play_style: null });
    } catch (error: any) {
      // Handle case where table doesn't exist
      if (error?.message?.includes('sport_profiles') || error?.code === '42P01') {
        setSportProfile({ play_style: null });
      } else {
        devError('AthleteProfile', 'Error loading sport profile:', error);
        setSportProfile({ play_style: null });
      }
    }
  };

  const loadRatingsForSport = async (sportId: string) => {
    if (!userId || !sportId) return;

    try {
      // Load ratings filtered by sport
      const { data: ratingsData, error: ratingsError } = await supabase
        .from('self_ratings')
        .select(`
          profile_id,
          attribute_id,
          rating,
          sport_attributes!inner(
            id,
            name,
            sport_id,
            sport:sports!inner(
              id,
              name
            )
          )
        `)
        .eq('profile_id', userId)
        .eq('sport_attributes.sport_id', sportId);

      if (ratingsError) {
        devError('AthleteProfile', 'Error loading ratings:', ratingsError);
        setRatings([]);
        return;
      }

      // Load cosigns for this profile (cosigns table uses attribute TEXT slug, not attribute_id)
      const { data: cosignsData, error: cosignsError } = await supabase
        .from('cosigns')
        .select('to_user_id, attribute')
        .eq('to_user_id', userId);

      if (cosignsError) {
        devError('AthleteProfile', 'Error loading cosigns:', cosignsError);
      }

      // Load user's cosigns for this profile (if viewing as logged-in user); order by created_at desc so we keep latest per attribute for 30-day cooldown.
      const userCosignedSlugs: Set<string> = new Set();
      const userCosignCreatedAtBySlug: Record<string, string> = {};
      if (user) {
        const { data: userCosignsData, error: userCosignsError } = await supabase
          .from('cosigns')
          .select('attribute, created_at')
          .eq('from_user_id', user.id)
          .eq('to_user_id', userId)
          .order('created_at', { ascending: false });

        if (!userCosignsError && userCosignsData) {
          userCosignsData.forEach((c: { attribute?: string; created_at?: string }) => {
            if (c.attribute) {
              userCosignedSlugs.add(c.attribute);
              if (c.created_at && !userCosignCreatedAtBySlug[c.attribute]) {
                userCosignCreatedAtBySlug[c.attribute] = c.created_at;
              }
            }
          });
        }
      }

      // Count cosigns per attribute (by slug)
      const cosignCountsBySlug: Record<string, number> = {};
      cosignsData?.forEach((cosign) => {
        if (cosign.attribute) {
          cosignCountsBySlug[cosign.attribute] = (cosignCountsBySlug[cosign.attribute] || 0) + 1;
        }
      });

      // Build ratings array (deduplicate by attribute_id to avoid duplicate keys)
      const seenIds = new Set<string>();
      const ratingsArray: AttributeRating[] = [];
      ratingsData?.forEach((r: any) => {
        const attributeId = r.attribute_id;
        if (seenIds.has(attributeId)) return; // skip duplicates
        seenIds.add(attributeId);
        const slug = attributeNameToSlug(r.sport_attributes?.name ?? '');
        const userHasCosigned = !!(slug && user && userCosignedSlugs.has(slug));
        const created_at = slug ? userCosignCreatedAtBySlug[slug] : undefined;
        const COSIGN_PENDING_DAYS = 30;
        const isCosignPending = userHasCosigned && created_at
          ? (Date.now() - new Date(created_at).getTime() < COSIGN_PENDING_DAYS * 24 * 60 * 60 * 1000)
          : false;
        const isOwnProfile = user && user.id === userId;
        const canCosign = !!user && !isOwnProfile && (!userHasCosigned || !isCosignPending);

        ratingsArray.push({
          attribute_id: attributeId,
          attribute_name: r.sport_attributes.name,
          sport_name: r.sport_attributes.sport.name,
          rating: r.rating,
          cosign_count: slug ? (cosignCountsBySlug[slug] || 0) : 0,
          can_cosign: canCosign,
          has_cosigned: userHasCosigned,
          is_cosign_pending: isCosignPending,
        });
      });

      setRatings(ratingsArray);
    } catch (err) {
      devError('AthleteProfile', 'Error loading ratings for sport:', err);
      setRatings([]);
    }
  };

  const closeCosignModal = () => {
    setCosignModal(null);
    setCosignError(null);
  };

  const handleCosign = async () => {
    if (!user || !cosignModal || !userId) return;

    setIsSubmitting(true);
    setCosignError(null);

    try {
      // cosigns table uses attribute (TEXT slug) and run_id (required). Profile cosigns may need run context.
      const attributeSlug = attributeNameToSlug(cosignModal.attributeName);
      if (!attributeSlug) {
        setCosignError('This skill cannot be cosigned (invalid attribute).');
        setIsSubmitting(false);
        return;
      }
      // Profile cosigns: run_id may be required by DB. If your schema has run_id NOT NULL, make it nullable for profile cosigns or use an RPC.
      // Test plan (iPhone TestFlight): Open another user's profile → tap Cosign on a skill → submit; success or clear error (no "invalid or unable").
      const insertPayload: Record<string, unknown> = {
        from_user_id: user.id,
        to_user_id: userId,
        attribute: attributeSlug,
        run_id: null,
      };
      if (cosignComment.trim()) {
        insertPayload.note = cosignComment.trim();
      }

      const { error: cosignErr } = await supabase
        .from('cosigns')
        .insert(insertPayload);

      if (cosignErr) {
        if (__DEV__) console.warn('[Cosign] Supabase error', { code: cosignErr.code, message: cosignErr.message, details: cosignErr.details, hint: cosignErr.hint });
        let errorMessage = 'Failed to cosign. Please try again.';
        if (cosignErr.code === '23505') {
          errorMessage = 'You\'ve already cosigned this skill.';
        } else if (cosignErr.message?.includes('self') || cosignErr.message?.includes('own')) {
          errorMessage = 'You can\'t cosign your own skills.';
        } else if (cosignErr.message?.includes('run_id') || cosignErr.code === '23502') {
          errorMessage = 'Cosign from profile isn\'t supported yet. Cosign from a run recap.';
        } else {
          errorMessage = 'Unable to cosign. Please try again.';
        }
        setCosignError(errorMessage);
        setIsSubmitting(false);
        return;
      }

      await playInitialBuzz();

      closeCosignModal();
      if (selectedSportId) loadRatingsForSport(selectedSportId);
    } catch (err: any) {
      if (__DEV__) {
        devError('AthleteProfile', 'cosign failed:', err);
      }
      setCosignError(UI_GENERIC);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading profile...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !profile) {
    return (
      <Screen>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error || 'Athlete not found.'}</Text>
          <Button
            title="Retry"
            onPress={loadProfile}
            variant="primary"
          />
        </View>
      </Screen>
    );
  }

  return (
    <>
      <CosignModal
        visible={cosignModal?.visible || false}
        attributeName={cosignModal?.attributeName || ''}
        sportName={cosignModal?.sportName || ''}
        error={cosignError}
        onConfirm={handleCosign}
        onCancel={closeCosignModal}
        isSubmitting={isSubmitting}
      />
      <Screen>
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding }]}
          showsVerticalScrollIndicator={false}
        >
          <Header title={profile.name ?? 'Athlete'} />
          
          <Card style={styles.profileCard}>
            <View style={styles.profileHeader}>
              <View style={styles.profileHeaderText}>
                <Text style={[styles.profileUsername, { color: colors.textMuted }]}>@{profile.username ?? 'no-username'}</Text>
                <Text style={[styles.followerCount, { color: colors.textMuted }]}>
                  {formatFollowerCount(followersCount)} followers
                </Text>
              </View>
              {!isOwnProfile && user && (
                <View style={styles.profileActions}>
                  <MessageButton targetUserId={userId!} pill style={styles.actionPill} />
                  <ProfileNavPill
                    icon={isFollowing ? 'checkmark.circle.fill' : 'person.badge.plus.fill'}
                    label={isFollowing ? 'Following' : 'Follow'}
                    onPress={toggleFollow}
                    loading={toggleLoading}
                    disabled={toggleLoading}
                    showChevron={false}
                    active={isFollowing}
                    style={styles.actionPill}
                  />
                </View>
              )}
            </View>
            {profile.bio && (
              <Text style={[styles.bioText, { color: colors.text }]}>{profile.bio}</Text>
            )}
            {/* Tappable follower/following counts - navigate to list pages */}
            <View style={styles.followLinks}>
              <TouchableOpacity
                onPress={() => userId && router.push(`/athletes/${userId}/followers` as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.followLinkText, { color: colors.primary }]}>
                  {formatFollowerCount(followersCount)} followers
                </Text>
              </TouchableOpacity>
              <Text style={[styles.followLinkSeparator, { color: colors.textMuted }]}> · </Text>
              <TouchableOpacity
                onPress={() => userId && router.push(`/athletes/${userId}/following` as any)}
                activeOpacity={0.7}
              >
                <Text style={[styles.followLinkText, { color: colors.primary }]}>
                  {formatFollowerCount(followingCount)} following
                </Text>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Sport Switcher - Horizontal chips */}
          {athleteSports.length > 1 && (
            <View style={styles.sportSwitcherContainer}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.sportSwitcherScroll}
              >
                {athleteSports.map((sport) => {
                  const isSelected = sport.id === selectedSportId;
                  return (
                    <TouchableOpacity
                      key={sport.id}
                      style={[
                        styles.sportChip,
                        {
                          backgroundColor: isSelected ? colors.primary : colors.surfaceAlt,
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedSportId(sport.id)}
                    >
                      <AppText
                        variant="muted"
                        color={isSelected ? 'textOnPrimary' : 'text'}
                        style={styles.sportChipText}
                      >
                        {sport.name}
                      </AppText>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Sport-specific play style */}
          {sportProfile?.play_style && (
            <Card style={styles.profileCard}>
              <Text style={[styles.profileLabel, { color: colors.textMuted }]}>Play Style</Text>
              <Text style={[styles.profileValue, { color: colors.text }]}>{sportProfile.play_style}</Text>
            </Card>
          )}

          {ratings.length > 0 ? (
            <View style={styles.ratingsSection}>
              <SectionTitle>Skill Ratings</SectionTitle>
              {ratings.map((rating) => (
                <AttributeRow
                  key={rating.attribute_id}
                  attributeName={rating.attribute_name}
                  sportName={rating.sport_name}
                  selfRating={rating.rating}
                  cosignCount={rating.cosign_count}
                  canCosign={rating.can_cosign}
                  hasCosigned={rating.has_cosigned}
                  isCosignPending={rating.is_cosign_pending}
                  cosignLoading={cosignModal?.attributeId === rating.attribute_id && isSubmitting}
                  onCosignPress={() => {
                    setCosignModal({
                      visible: true,
                      attributeId: rating.attribute_id,
                      attributeName: rating.attribute_name,
                      sportName: rating.sport_name,
                    });
                    setCosignComment('');
                    setCosignError(null);
                  }}
                />
              ))}
            </View>
          ) : (
            <Card>
              <Text style={[styles.noRatingsText, { color: colors.textMuted }]}>No skill ratings yet</Text>
            </Card>
          )}
        </ScrollView>
      </Screen>
    </>
  );
}

function CosignModal({
  visible,
  attributeName,
  sportName,
  error,
  onConfirm,
  onCancel,
  isSubmitting,
}: {
  visible: boolean;
  attributeName: string;
  sportName: string;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
}) {
  const { colors } = useThemeColors();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={modalStyles.overlay}>
        <Card style={modalStyles.content}>
          <Text style={[modalStyles.title, { color: colors.text }]}>Cosign Skill</Text>
          <Text style={[modalStyles.subtitle, { color: colors.textMuted }]}>
            {sportName}: {attributeName}
          </Text>
          <Text style={[modalStyles.hint, { color: colors.textMuted }]}>
            You can cosign each skill once every 30 days.
          </Text>

          {error && (
            <Text style={[modalStyles.errorText, { color: colors.text }]}>{error}</Text>
          )}

          <View style={[modalStyles.buttons, { gap: Spacing.sm }]}>
            <ProfileNavPill
              icon="xmark.circle.fill"
              label="Cancel"
              onPress={onCancel}
              disabled={isSubmitting}
              showChevron={false}
              style={modalStyles.halfButton}
            />
            <ProfileNavPill
              icon="medal.fill"
              label="Cosign"
              onPress={onConfirm}
              loading={isSubmitting}
              disabled={isSubmitting}
              showChevron={false}
              active
              compact
              style={StyleSheet.flatten([modalStyles.halfButton, { minHeight: 24, flex: 0.5 }]) as ViewStyle}
            />
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h3,
  },
  errorText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  scrollContent: {},
  profileCard: {
    marginBottom: Spacing.xl,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  profileHeaderText: {
    flex: 1,
  },
  profileUsername: {
    ...Typography.body,
  },
  followerCount: {
    ...Typography.mutedSmall,
    marginTop: Spacing.xs,
  },
  profileActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 0,
  },
  actionPill: {
    flex: 1,
  },
  followLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    flexWrap: 'wrap',
  },
  followLinkText: {
    ...Typography.mutedSmall,
  },
  followLinkSeparator: {
    ...Typography.mutedSmall,
  },
  bioText: {
    ...Typography.body,
    marginTop: Spacing.sm,
  },
  profileLabel: {
    ...Typography.muted,
    marginBottom: Spacing.xs,
  },
  profileValue: {
    ...Typography.body,
  },
  sportSwitcherContainer: {
    marginBottom: Spacing.lg,
  },
  sportSwitcherScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  sportChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  sportChipText: {
    fontWeight: '600',
  },
  ratingsSection: {
    marginBottom: Spacing.xl,
  },
  noRatingsText: {
    ...Typography.muted,
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 400,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  hint: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.lg,
    fontStyle: 'italic',
  },
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  input: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: Spacing.xs,
  },
  charCount: {
    ...Typography.mutedSmall,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.muted,
    marginBottom: Spacing.md,
  },
  buttons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  halfButton: {
    flex: 1,
    minHeight: 44,
  },
});
