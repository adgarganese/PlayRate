import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useFollow } from '@/hooks/useFollow';
import { Card } from './Card';
import { StatBar } from './StatBar';
import { ProfilePicture } from './ProfilePicture';
import { AppText } from './ui/AppText';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getSportDefinition, isSportEnabled } from '@/constants/sport-definitions';

type Sport = {
  id: string;
  name: string;
};

type SnapshotData = {
  name: string | null;
  username: string | null;
  playStyle: string | null;
  profilePictureUrl: string | null;
  shooting: number; // 0-100
  defense: number; // 0-100
  hustle: number; // 0-100
  ratingsCount: number;
  cosignCount: number;
  lastPlayed: string | null;
  activeSportId: string | null;
  activeSportName: string | null;
};

type PlayRateSnapshotCardProps = {
  /** When set, loads and displays this user's snapshot (for viewing other athletes). When omitted, uses current user. */
  targetUserId?: string | null;
  onPress?: () => void;
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

export function PlayRateSnapshotCard({ targetUserId, onPress }: PlayRateSnapshotCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const effectiveUserId = targetUserId ?? user?.id ?? null;
  const { followersCount } = useFollow(effectiveUserId);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SnapshotData | null>(null);
  const [userSports, setUserSports] = useState<Sport[]>([]);
  const [showSportSelector, setShowSportSelector] = useState(false);
  const [switchingSport, setSwitchingSport] = useState(false);

  useEffect(() => {
    if (effectiveUserId) {
      loadSnapshot();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveUserId]);

  const loadSnapshot = async (sportIdOverride?: string) => {
    if (!effectiveUserId) return;

    setLoading(true);
    try {
      // Fetch profile with active_sport_id (may not exist if migration not run)
      let profile: any = null;
      let profileError: any = null;

      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, avatar_url, active_sport_id')
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (error) {
        // If active_sport_id column doesn't exist, try without it
        if (error.message?.includes('active_sport_id') || error.message?.includes('column') || error.code === '42703') {
          const { data: dataWithoutActiveSport, error: errorWithoutActiveSport } = await supabase
            .from('profiles')
            .select('user_id, name, username, bio, avatar_url')
            .eq('user_id', effectiveUserId)
            .maybeSingle();

          if (errorWithoutActiveSport && __DEV__) {
            console.error('Profile load error (without active_sport_id):', errorWithoutActiveSport);
            // Even if there's an error, try to use the data
            profile = dataWithoutActiveSport;
            if (profile) {
              profile.active_sport_id = null;
            }
          } else {
            profile = { ...dataWithoutActiveSport, active_sport_id: null };
          }
        } else {
          if (__DEV__) console.error('Profile load error:', error);
          profileError = error;
        }
      } else {
        profile = data;
      }

      if (profileError || !profile) {
        if (__DEV__) console.error('Unable to load profile');
        setLoading(false);
        return;
      }

      // Fetch user's sports
      const { data: profileSports, error: sportsError } = await supabase
        .from('profile_sports')
        .select('sport:sports(id, name)')
        .eq('profile_id', effectiveUserId);

      // Sort sports by name client-side
      let sports: Sport[] = [];
      if (!sportsError && profileSports) {
        const sortedSports = (profileSports || []).slice().sort((a: any, b: any) => {
          const nameA = a.sport?.name || '';
          const nameB = b.sport?.name || '';
          return nameA.localeCompare(nameB);
        });
        sports = sortedSports.map((ps: any) => ps.sport).filter(Boolean);
      }
      const enabledSports = sports.filter((s) => isSportEnabled(s.name));
      setUserSports(enabledSports);

      // Determine active sport (use override when viewing another user's profile and they picked a sport)
      let activeSportId = sportIdOverride ?? profile?.active_sport_id;
      let activeSportName: string | null = null;

      // If current active sport is disabled (e.g. soccer when SOCCER_ENABLED is false), switch to first enabled
      if (activeSportId && enabledSports.length > 0) {
        const activeSport = sports.find((s) => s.id === activeSportId);
        if (activeSport && !isSportEnabled(activeSport.name)) {
          activeSportId = enabledSports[0].id;
        }
      }

      // If no active sport but user has sports, use first one
      if (!activeSportId && enabledSports.length > 0) {
        activeSportId = enabledSports[0].id;
        // Only persist to DB when viewing own profile (not when targetUserId is set)
        if (!targetUserId) {
          try {
            await supabase
              .from('profiles')
              .update({ active_sport_id: activeSportId })
              .eq('user_id', user!.id);
          } catch (updateError: any) {
            if (updateError?.code !== '42703' && !updateError?.message?.includes('active_sport_id') && __DEV__) {
              console.error('Error updating active_sport_id:', updateError);
            }
          }
        }
      }

      // Find active sport name
      if (activeSportId) {
        const activeSport = sports.find(s => s.id === activeSportId);
        activeSportName = activeSport?.name || null;
      }

      // Fetch sport-specific profile data for active sport
      let playStyle: string | null = null;
      if (activeSportId) {
        const { data: sportProfile } = await supabase
          .from('sport_profiles')
          .select('play_style')
          .eq('user_id', effectiveUserId)
          .eq('sport_id', activeSportId)
          .maybeSingle();

        playStyle = sportProfile?.play_style || null;
      }

      // If no sport profile exists, fall back to global play_style (backwards compatibility)
      if (!playStyle && profile) {
        const { data: legacyProfile } = await supabase
          .from('profiles')
          .select('play_style')
          .eq('user_id', effectiveUserId)
          .maybeSingle();
        playStyle = legacyProfile?.play_style || null;
      }

      // Fetch ratings for active sport only (filter by sport_id through sport_attributes)
      let ratingsCount = 0;
      let cosignCount = 0;
      let lastPlayed: string | null = null;
      let shooting = 0;
      let defense = 0;
      let hustle = 0;

      if (activeSportId && activeSportName) {
        // Fetch self_ratings with sport_attributes to filter by active sport
        const { data: ratingsData, error: ratingsError } = await supabase
          .from('self_ratings')
          .select(`
            rating,
            last_updated,
            attribute_id,
            attribute:sport_attributes!inner(id, name, sport_id)
          `)
          .eq('profile_id', effectiveUserId)
          .eq('attribute.sport_id', activeSportId);

        if (!ratingsError && ratingsData) {
          ratingsCount = ratingsData.length;

          // Get last played (most recent rating update)
          if (ratingsData.length > 0) {
            const sortedByDate = [...ratingsData].sort((a, b) =>
              new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
            );
            lastPlayed = sortedByDate[0].last_updated;
          }

          // Calculate stats from actual ratings
          const sportDef = getSportDefinition(activeSportName);
          if (sportDef && ratingsData.length > 0) {
            // Create a map of attribute name -> rating (1-10 scale)
            const ratingMap = new Map<string, number>();
            ratingsData.forEach((r: any) => {
              const attrName = r.attribute?.name;
              if (attrName && r.rating) {
                ratingMap.set(attrName, r.rating);
              }
            });

            // Calculate stats based on sport-specific attribute mappings
            if (sportDef.key === 'basketball') {
              // Basketball: Shooting = "Shooting" attribute
              const shootingRating = ratingMap.get('Shooting');
              shooting = shootingRating ? shootingRating * 10 : 0; // Convert 1-10 to 0-100

              // Basketball: Defense = average of "Perimeter Defense" + "Post Defense"
              const perimeterDef = ratingMap.get('Perimeter Defense') || 0;
              const postDef = ratingMap.get('Post Defense') || 0;
              const defenseRatings = [perimeterDef, postDef].filter(r => r > 0);
              if (defenseRatings.length > 0) {
                const avgDefense = defenseRatings.reduce((sum, r) => sum + r, 0) / defenseRatings.length;
                defense = avgDefense * 10; // Convert 1-10 to 0-100
              } else {
                defense = 0;
              }

              // Basketball: Hustle = "Athleticism" attribute
              const hustleRating = ratingMap.get('Athleticism');
              hustle = hustleRating ? hustleRating * 10 : 0; // Convert 1-10 to 0-100
            } else if (sportDef.key === 'soccer') {
              // Soccer: Shooting = "Shooting / Finishing" attribute
              const shootingRating = ratingMap.get('Shooting / Finishing');
              shooting = shootingRating ? shootingRating * 10 : 0; // Convert 1-10 to 0-100

              // Soccer: Defense = "Defending" attribute
              const defenseRating = ratingMap.get('Defending');
              defense = defenseRating ? defenseRating * 10 : 0; // Convert 1-10 to 0-100

              // Soccer: Hustle = average of "Athleticism", "Speed / Acceleration", "Stamina / Work Rate"
              const athleticism = ratingMap.get('Athleticism') || 0;
              const speedAccel = ratingMap.get('Speed / Acceleration') || 0;
              const stamina = ratingMap.get('Stamina / Work Rate') || 0;
              const hustleRatings = [athleticism, speedAccel, stamina].filter(r => r > 0);
              if (hustleRatings.length > 0) {
                const avgHustle = hustleRatings.reduce((sum, r) => sum + r, 0) / hustleRatings.length;
                hustle = avgHustle * 10; // Convert 1-10 to 0-100
              } else {
                hustle = 0;
              }
            }
          }
        }

        // Count cosigns for user (cosigns table has attribute TEXT and to_user_id, no attribute_id/sport_id)
        const { count: cosignCountResult } = await supabase
          .from('cosigns')
          .select('*', { count: 'exact', head: true })
          .eq('to_user_id', effectiveUserId);

        if (cosignCountResult != null) {
          cosignCount = cosignCountResult;
        }
      } else {
        // Fallback: count all ratings if no active sport
        const { count: allRatingsCount } = await supabase
          .from('self_ratings')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', effectiveUserId);
        ratingsCount = allRatingsCount || 0;

        const { count: allCosignCount } = await supabase
          .from('cosigns')
          .select('*', { count: 'exact', head: true })
          .eq('to_user_id', effectiveUserId);
        cosignCount = allCosignCount || 0;

        const { data: lastRating } = await supabase
          .from('self_ratings')
          .select('last_updated')
          .eq('profile_id', effectiveUserId)
          .order('last_updated', { ascending: false })
          .limit(1)
          .maybeSingle();
        lastPlayed = lastRating?.last_updated || null;
      }

      setData({
        name: profile?.name || null,
        username: profile?.username || null,
        playStyle: playStyle || 'Not set',
        profilePictureUrl: profile?.avatar_url || null,
        shooting,
        defense,
        hustle,
        ratingsCount,
        cosignCount,
        lastPlayed,
        activeSportId,
        activeSportName,
      });
    } catch (error) {
      if (__DEV__) console.error('Error loading snapshot:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSportSelect = async (sportId: string) => {
    if (!effectiveUserId || switchingSport || sportId === data?.activeSportId) {
      setShowSportSelector(false);
      return;
    }

    setSwitchingSport(true);
    try {
      // Only persist to DB when viewing own profile; when targetUserId, just reload with sport override
      if (!targetUserId && user) {
        const { error } = await supabase
          .from('profiles')
          .update({ active_sport_id: sportId })
          .eq('user_id', user.id);
        if (error && error.code !== '42703' && !error.message?.includes('active_sport_id') && __DEV__) {
          console.error('Error updating active sport:', error);
        }
      }
      await loadSnapshot(sportId);
    } catch (error: any) {
      if (error?.code === '42703' || error?.message?.includes('active_sport_id')) {
        await loadSnapshot(sportId);
      } else if (__DEV__) {
        console.error('Error switching sport:', error);
      }
    } finally {
      setSwitchingSport(false);
      setShowSportSelector(false);
    }
  };

  const formatLastPlayed = (dateString: string | null): string => {
    if (!dateString) return 'Never';

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  if (!effectiveUserId) return null;

  const profileRowBlock = data ? (
    <View style={styles.profileRow}>
      <ProfilePicture
        avatarUrl={data.profilePictureUrl}
        size={64}
        editable={false}
      />
      <View style={styles.nameContainer}>
        <View style={styles.nameRow}>
          <Text style={[styles.name, { color: colors.text }]}>{data.name || 'No name'}</Text>
          {data.username && (
            <Text style={[styles.username, { color: colors.textMuted }]}>@{data.username}</Text>
          )}
        </View>
        <TouchableOpacity
          onPress={() => effectiveUserId && router.push(`/athletes/${effectiveUserId}/followers` as any)}
          accessibilityLabel="View followers"
          accessibilityRole="button"
        >
          <Text style={[styles.followerCount, { color: colors.textMuted }]}>
            {formatFollowerCount(followersCount)} followers
          </Text>
        </TouchableOpacity>
        <Text style={[styles.playStyle, { color: colors.textMuted }]}>Play style: {data.playStyle}</Text>
      </View>
    </View>
  ) : null;

  const sportLabelAbove = data && userSports.length > 0 ? (
    <AppText variant="mutedSmall" color="textMuted" style={styles.snapshotSportLabel}>
      Snapshot Sport
    </AppText>
  ) : null;

  const sportChipBlock = data && userSports.length > 1 ? (
    <TouchableOpacity
      style={[styles.sportChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}
      onPress={() => setShowSportSelector(true)}
      disabled={switchingSport}
    >
      <AppText variant="muted" color="text" style={styles.sportChipText}>
        {data.activeSportName || 'Select Sport'}
      </AppText>
      <IconSymbol name="chevron.down" size={14} color={colors.textMuted} style={styles.sportChipIcon} />
    </TouchableOpacity>
  ) : null;

  const sportLabelBlock = data && userSports.length === 1 && data.activeSportName ? (
    <View style={[styles.sportLabel, { backgroundColor: colors.surfaceAlt }]}>
      <AppText variant="mutedSmall" color="textMuted">{data.activeSportName}</AppText>
    </View>
  ) : null;

  const statsBlock = data ? (
    <View style={styles.statsContainer}>
      <StatBar label="Shooting" value={data.shooting} />
      <StatBar label="Defense" value={data.defense} />
      <StatBar label="Hustle" value={data.hustle} />
    </View>
  ) : null;

  const footerBlock = data ? (
    <View style={[styles.footer, { borderTopColor: colors.border }]}>
      <Text style={[styles.footerText, { color: colors.textMuted }]}>
        Ratings: {data.ratingsCount} • Cosigns: {data.cosignCount} • Last played: {formatLastPlayed(data.lastPlayed)}
      </Text>
    </View>
  ) : null;

  const cardContent = (
    <Card style={{ backgroundColor: colors.surfaceElevated }}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading snapshot...</Text>
        </View>
      ) : data ? (
        <>
          <View style={styles.header}>
            {onPress ? (
              <Pressable
                onPress={onPress}
                style={({ pressed }) => [pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="View your profile"
              >
                {profileRowBlock}
              </Pressable>
            ) : (
              profileRowBlock
            )}
            {sportLabelAbove}
            {sportChipBlock}
            {sportLabelBlock}
          </View>

          {onPress ? (
            <Pressable
              onPress={onPress}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="View your profile"
            >
              {statsBlock}
              {footerBlock}
            </Pressable>
          ) : (
            <>
              {statsBlock}
              {footerBlock}
            </>
          )}
        </>
      ) : (
        <Text style={[styles.errorText, { color: colors.textMuted }]}>Unable to load snapshot</Text>
      )}
    </Card>
  );

  return (
    <>
      {cardContent}

      {/* Sport Selector Modal - always render so chip works on home screen */}
      <Modal
        visible={showSportSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSportSelector(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSportSelector(false)}
        >
          <Card style={styles.modalContent}>
            <AppText variant="h3" color="text" style={styles.modalTitle}>Select Sport</AppText>
            <ScrollView style={styles.modalList}>
              {userSports.map((sport) => (
                <TouchableOpacity
                  key={sport.id}
                  style={[
                    styles.modalOption,
                    {
                      backgroundColor: data?.activeSportId === sport.id ? colors.surfaceAlt : 'transparent',
                      borderBottomColor: colors.border,
                    }
                  ]}
                  onPress={() => handleSportSelect(sport.id)}
                  disabled={switchingSport}
                >
                  <AppText
                    variant={data?.activeSportId === sport.id ? 'bodyBold' : 'body'}
                    color={data?.activeSportId === sport.id ? 'primary' : 'text'}
                  >
                    {sport.name}
                  </AppText>
                  {data?.activeSportId === sport.id && (
                    <IconSymbol name="checkmark.circle.fill" size={20} color={colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalCancel, { borderTopColor: colors.border }]}
              onPress={() => setShowSportSelector(false)}
            >
              <AppText variant="body" color="textMuted">Cancel</AppText>
            </TouchableOpacity>
          </Card>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    marginBottom: 16,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  nameContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  name: {
    ...Typography.h3,
  },
  username: {
    ...Typography.body,
  },
  followerCount: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.xs,
  },
  playStyle: {
    ...Typography.muted,
  },
  statsContainer: {
    marginBottom: Spacing.lg,
  },
  footer: {
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  footerText: {
    ...Typography.mutedSmall,
  },
  errorText: {
    ...Typography.muted,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  snapshotSportLabel: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderWidth: 1,
    marginTop: 0,
  },
  sportChipText: {
    marginRight: Spacing.xs,
  },
  sportChipIcon: {
    // Icon styling
  },
  sportLabel: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    marginTop: Spacing.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    maxHeight: '70%',
  },
  modalTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCancel: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
});
