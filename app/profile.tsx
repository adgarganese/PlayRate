import React, { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, TextInput as RNTextInput, Pressable } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuth } from '../contexts/auth-context';
import { supabase } from '../lib/supabase';
import { useFollow } from '../hooks/useFollow';

import { KeyboardScreen } from '../components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getPlayStylesForSport, isSportEnabled } from '@/constants/sport-definitions';
import { getTierInfoFromCosigns } from '@/lib/tiers';

type Profile = {
  user_id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  play_style: string | null;
  avatar_url: string | null;
  created_at: string;
};

const PLAY_STYLE_CUSTOM = 'Custom' as const;

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return count.toLocaleString();
}

function formatActiveStatus(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Active today';
  if (diffDays <= 7) return 'Active this week';
  return '';
}

export default function ProfileScreen() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { followersCount, followingCount } = useFollow(user?.id ?? null);
  const router = useRouter();
  const { colors, isDark } = useThemeColors();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeSportName, setActiveSportName] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    playStyle: '',
  });
  const [customPlayStyle, setCustomPlayStyle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cosignCount, setCosignCount] = useState(0);
  const [checkInsCount, setCheckInsCount] = useState(0);
  const [favoriteCourtsCount, setFavoriteCourtsCount] = useState(0);
  const [lastActivity, setLastActivity] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      const timer = setTimeout(() => {
        router.replace('/sign-in');
      }, 100);
      return () => clearTimeout(timer);
    }

    if (user) {
      loadProfile();
    }
  }, [user, authLoading]);

  const loadProfile = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Try to load profile with all columns
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, play_style, avatar_url, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (__DEV__) console.warn('[profile] load', error);
        
        // If avatar_url column doesn't exist, try without it
        if (error.message?.includes('avatar_url') || error.message?.includes('column "avatar_url"')) {
          const { data: dataWithoutAvatar, error: errorWithoutAvatar } = await supabase
            .from('profiles')
            .select('user_id, name, username, bio, created_at')
            .eq('user_id', user.id)
            .maybeSingle();

          if (errorWithoutAvatar) {
            if (__DEV__) console.warn('[profile] load (no avatar)', errorWithoutAvatar);
            Alert.alert('Error', `Unable to load your profile: ${errorWithoutAvatar.message}`);
            setLoading(false);
            return;
          }

          if (dataWithoutAvatar) {
            const profileData: Profile = { ...dataWithoutAvatar, avatar_url: null, play_style: null };
            setProfile(profileData);
            setAvatarUrl(null);
            setFormData({
              name: profileData.name || '',
              bio: profileData.bio || '',
              playStyle: '',
            });
            setCustomPlayStyle('');
            setLoading(false);
            return;
          }
        } else {
          // Other errors
          if (__DEV__) console.warn('[profile] load', error);
          Alert.alert('Error', `Unable to load your profile: ${error.message || 'Please try again.'}`);
          setLoading(false);
          return;
        }
      }

      if (!data) {
        Alert.alert('Profile Not Found', 'Your profile was not found. Please contact support or try signing out and back in.');
        setLoading(false);
        return;
      }

      // Successfully loaded profile
      setProfile(data);
      setAvatarUrl(data.avatar_url || null);
      
      // Load active sport for sport-specific play styles
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('active_sport_id')
        .eq('user_id', user.id)
        .maybeSingle();

      let sportName: string | null = null;
      if (currentProfile?.active_sport_id) {
        const { data: sportData } = await supabase
          .from('sports')
          .select('name')
          .eq('id', currentProfile.active_sport_id)
          .maybeSingle();
        sportName = sportData?.name || null;
        if (sportName && !isSportEnabled(sportName)) {
          sportName = 'Basketball';
        }
        setActiveSportName(sportName);
      }

      // Load sport-specific play style if available
      let playStyle: string | null = null;
      if (currentProfile?.active_sport_id) {
        try {
          const { data: sportProfile } = await supabase
            .from('sport_profiles')
            .select('play_style')
            .eq('user_id', user.id)
            .eq('sport_id', currentProfile.active_sport_id)
            .maybeSingle();
          playStyle = sportProfile?.play_style || null;
        } catch (error) {
          if (__DEV__) console.warn('[profile:load] sport_profiles', error);
          playStyle = data.play_style || null;
        }
      }
      
      // Fall back to global play_style if no sport-specific one
      if (!playStyle) {
        playStyle = data.play_style || null;
      }

      // Get play style options for active sport (or default to basketball)
      const playStyleOptions = sportName ? getPlayStylesForSport(sportName) : getPlayStylesForSport('Basketball');
      const playStyleStr = playStyle || '';
      
      setFormData({
        name: data.name || '',
        bio: data.bio || '',
        playStyle: playStyleOptions.includes(playStyleStr as any) ? playStyleStr : (playStyleStr ? PLAY_STYLE_CUSTOM : ''),
      });
      setCustomPlayStyle(playStyleOptions.includes(playStyleStr as any) ? '' : playStyleStr);

      // Load cosign count, favorite courts, last activity
      try {
        const { data: profileWithCosign } = await supabase.from('profiles').select('cosign_count').eq('user_id', user.id).maybeSingle();
        if (profileWithCosign?.cosign_count != null) {
          setCosignCount(profileWithCosign.cosign_count);
        } else {
          const { count } = await supabase.from('cosigns').select('*', { count: 'exact', head: true }).eq('to_user_id', user.id);
          setCosignCount(count ?? 0);
        }

        const { count: fcCount } = await supabase.from('court_follows').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setFavoriteCourtsCount(fcCount ?? 0);

        const { data: lastRating } = await supabase.from('self_ratings').select('last_updated').eq('profile_id', user.id).order('last_updated', { ascending: false }).limit(1).maybeSingle();
        setLastActivity(lastRating?.last_updated ?? null);
      } catch (error) {
        if (__DEV__) console.warn('[profile:load] lastActivity', error);
      }
    } catch (err: any) {
      if (__DEV__) console.warn('[profile] load unexpected', err);
      Alert.alert('Error', `An unexpected error occurred: ${err.message || 'Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;

    // Determine final play_style value
    let playStyleValue: string | null = null;
    if (formData.playStyle === PLAY_STYLE_CUSTOM) {
      playStyleValue = customPlayStyle.trim() || null;
    } else if (formData.playStyle) {
      playStyleValue = formData.playStyle;
    }

    setSaving(true);
    
    // Update global profile fields
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        name: formData.name || null,
        bio: formData.bio || null,
      })
      .eq('user_id', user.id);

    if (profileError) {
      setSaving(false);
      Alert.alert('Error', 'Unable to save changes. Please try again.');
      return;
    }

    // Update or insert play_style in sport_profiles for active sport
    // Get active_sport_id (fetch current from database)
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('active_sport_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const activeSportId = currentProfile?.active_sport_id;
    
    if (activeSportId) {
      // Upsert sport_profile for active sport
      const { error: sportProfileError } = await supabase
        .from('sport_profiles')
        .upsert({
          user_id: user.id,
          sport_id: activeSportId,
          play_style: playStyleValue,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,sport_id',
        });

      if (sportProfileError) {
        if (__DEV__) console.warn('[profile] save sport profile', sportProfileError);
        // Continue - not critical error
      }
    }

    // Also update legacy play_style in profiles for backwards compatibility
    if (playStyleValue) {
      await supabase
        .from('profiles')
        .update({ play_style: playStyleValue })
        .eq('user_id', user.id);
    }

    setSaving(false);

    if (profileError) {
      Alert.alert('Error', 'Unable to save changes. Please try again.');
    } else {
      Alert.alert('Saved', 'Your profile has been updated!');
      setEditing(false);
      await loadProfile();
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            await new Promise(resolve => setTimeout(resolve, 100));
            router.replace('/sign-in');
          } catch (error) {
            if (__DEV__) console.warn('[profile] sign out', error);
            router.replace('/sign-in');
          }
        },
      },
    ]);
  };

  if (authLoading || loading) {
    return <LoadingScreen message="Loading profile..." />;
  }

  if (!user || !profile) {
    return (
      <ErrorScreen
        message="Profile not found"
        onRetry={() => loadProfile()}
        retryLabel="Retry"
      />
    );
  }

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
        <Header
          title="My Profile"
          rightIcon={
            !editing
              ? {
                  name: 'pencil',
                  onPress: () => setEditing(true),
                  accessibilityLabel: 'Edit profile',
                }
              : undefined
          }
        />

        <Card style={styles.card}>
          {/* A) Identity: Avatar + Name + @username */}
          <View style={[styles.identitySection, { borderBottomColor: colors.border }]}>
            <ProfilePicture
              avatarUrl={avatarUrl}
              size={64}
              editable={true}
              onUpdate={(newUrl) => {
                setAvatarUrl(newUrl);
                if (profile) setProfile({ ...profile, avatar_url: newUrl });
                loadProfile();
              }}
            />
            <View style={styles.identityContent}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {profile.name || 'Add your name'}
              </Text>
              <Text style={[styles.profileUsername, { color: colors.textMuted }]} numberOfLines={1}>
                @{profile.username}
              </Text>
              <Text style={[styles.profilePictureHint, { color: colors.textMuted }]}>
                Tap avatar to change
              </Text>
            </View>
          </View>

          {/* B) Social row: Followers + Following */}
          <View style={[styles.socialRow, { borderBottomColor: colors.border }]}>
            <Pressable
              onPress={() => router.push(`/athletes/${user.id}/followers` as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.socialText, { color: colors.textMuted }]}>
                <Text style={[styles.socialNumber, { color: colors.text }]}>{formatCount(followersCount)}</Text> Followers
              </Text>
            </Pressable>
            <Text style={[styles.socialSeparator, { color: colors.textMuted }]}>·</Text>
            <Pressable
              onPress={() => router.push(`/athletes/${user.id}/following` as any)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={({ pressed }) => pressed && styles.pressed}
            >
              <Text style={[styles.socialText, { color: colors.textMuted }]}>
                <Text style={[styles.socialNumber, { color: colors.text }]}>{formatCount(followingCount)}</Text> Following
              </Text>
            </Pressable>
          </View>

          {/* C) Sports snapshot: Sport chip + Primary sport • Play style */}
          {(activeSportName || (profile.play_style && !editing) || (formData.playStyle && editing)) && (
            <View style={[styles.sportsSection, { borderBottomColor: colors.border }]}>
              {activeSportName && (
                <View style={[styles.sportChip, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                  <Text style={[styles.sportChipText, { color: colors.text }]}>{activeSportName}</Text>
                </View>
              )}
              {((editing && (formData.playStyle || customPlayStyle)) || (!editing && profile.play_style)) && (
                <Text style={[styles.sportPlayStyleLine, { color: colors.textMuted }]} numberOfLines={1}>
                  {activeSportName || 'Sport'} • {editing
                    ? (formData.playStyle === PLAY_STYLE_CUSTOM ? customPlayStyle : formData.playStyle)
                    : profile.play_style}
                </Text>
              )}
            </View>
          )}

          {/* D) Stats row: Compact badges with icons (Tier, Check-ins, Cosigns) */}
          <View style={[styles.statsRow, { borderBottomColor: colors.border }]}>
              {(() => {
                const tierInfo = getTierInfoFromCosigns(cosignCount);
                const tierColor = isDark ? tierInfo.darkColor : tierInfo.color;
                return (
                  <>
                    <View style={[styles.statsBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <IconSymbol name="medal.fill" size={12} color={tierColor} style={styles.statsBadgeIcon} />
                      <Text style={[styles.statsBadgeText, { color: colors.text }]}>{tierInfo.name}</Text>
                    </View>
                    {checkInsCount > 0 && (
                      <View style={[styles.statsBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                        <IconSymbol name="location.fill" size={12} color={colors.textMuted} style={styles.statsBadgeIcon} />
                        <Text style={[styles.statsBadgeText, { color: colors.textMuted }]}>
                          {formatCount(checkInsCount)} {checkInsCount === 1 ? 'check-in' : 'check-ins'}
                        </Text>
                      </View>
                    )}
                    <View style={[styles.statsBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                      <IconSymbol name="star.fill" size={12} color={colors.textMuted} style={styles.statsBadgeIcon} />
                      <Text style={[styles.statsBadgeText, { color: colors.textMuted }]}>
                        {formatCount(cosignCount)} cosigns
                      </Text>
                    </View>
                  </>
                );
              })()}
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Email</Text>
            <Text style={[styles.value, { color: colors.text }]}>{user.email}</Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Username</Text>
            <Text style={[styles.value, { color: colors.text }]}>@{profile.username}</Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>Username cannot be changed</Text>
          </View>

          {editing ? (
            <>
              <View style={styles.section}>
                <TextInput
                  label="Name"
                  placeholder="Enter your name"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  editable={!saving}
                />
              </View>

              <View style={styles.section}>
                <TextInput
                  label="Bio"
                  placeholder="Tell us about yourself"
                  value={formData.bio}
                  onChangeText={(text) => setFormData({ ...formData, bio: text })}
                  multiline
                  numberOfLines={4}
                  editable={!saving}
                  style={styles.bioInput}
                />
              </View>

              <View style={styles.section}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Play Style</Text>
                <View style={styles.playStyleGrid}>
                  {(activeSportName ? getPlayStylesForSport(activeSportName) : getPlayStylesForSport('Basketball')).map((option) => (
                  <Button
                    key={option}
                    title={option}
                    onPress={() => setFormData({ ...formData, playStyle: option })}
                    variant={formData.playStyle === option ? 'primary' : 'secondary'}
                    size="medium"
                    disabled={saving}
                    style={styles.playStyleButton}
                  />
                  ))}
                  <Button
                    title={PLAY_STYLE_CUSTOM}
                    onPress={() => setFormData({ ...formData, playStyle: PLAY_STYLE_CUSTOM })}
                    variant={formData.playStyle === PLAY_STYLE_CUSTOM ? 'primary' : 'secondary'}
                    size="medium"
                    disabled={saving}
                    style={styles.playStyleButton}
                  />
                </View>
                {formData.playStyle === PLAY_STYLE_CUSTOM && (
                  <View style={styles.customPlayStyleContainer}>
                    <RNTextInput
                      style={[styles.customPlayStyleInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                      placeholder="Enter custom play style (max 24 chars)"
                      placeholderTextColor={colors.textMuted}
                      value={customPlayStyle}
                      onChangeText={(text) => {
                        if (text.length <= 24) {
                          setCustomPlayStyle(text);
                        }
                      }}
                      editable={!saving}
                      maxLength={24}
                    />
                    <Text style={[styles.charCount, { color: colors.textMuted }]}>{customPlayStyle.length}/24</Text>
                  </View>
                )}
              </View>

              <View style={styles.buttonRow}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setEditing(false);
                    const currentPlayStyle = profile.play_style || '';
                  const playStyleOptions = activeSportName ? getPlayStylesForSport(activeSportName) : getPlayStylesForSport('Basketball');
                    setFormData({
                      name: profile.name || '',
                      bio: profile.bio || '',
                      playStyle: playStyleOptions.includes(currentPlayStyle as any) ? currentPlayStyle : (currentPlayStyle ? PLAY_STYLE_CUSTOM : ''),
                    });
                    setCustomPlayStyle(playStyleOptions.includes(currentPlayStyle as any) ? '' : currentPlayStyle);
                  }}
                  variant="secondary"
                  disabled={saving}
                  style={styles.halfButton}
                />
                <View style={styles.buttonSpacing} />
                <Button
                  title="Save"
                  onPress={handleSave}
                  variant="primary"
                  loading={saving}
                  disabled={saving}
                  style={styles.halfButton}
                />
              </View>
            </>
          ) : (
            <>
              {profile.name && (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Name</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{profile.name}</Text>
                </View>
              )}

              {profile.bio && (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Bio</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{profile.bio}</Text>
                </View>
              )}

              {profile.play_style && (
                <View style={styles.section}>
                  <Text style={[styles.label, { color: colors.textMuted }]}>Play Style</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{profile.play_style}</Text>
                </View>
              )}

              {!profile.name && !profile.bio && !profile.play_style && (
                <View style={[styles.emptyState, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.emptyStateText, { color: colors.textMuted }]}>
                    Your profile is empty. Click Edit to add your name and bio.
                  </Text>
                </View>
              )}
            </>
          )}

          <View style={styles.section}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Member since</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {new Date(profile.created_at).toLocaleDateString()}
            </Text>
          </View>
        </Card>

        <View style={styles.navPillsGrid}>
          <View style={styles.navPillsRow}>
            <ProfileNavPill
              icon="sportscourt.fill"
              label="My Sports"
              onPress={() => router.push('/my-sports')}
              style={styles.navPillHalf}
            />
            <View style={styles.navPillGap} />
            <ProfileNavPill
              icon="star.fill"
              label="Rate Yourself"
              onPress={() => router.push('/self-ratings')}
              style={styles.navPillHalf}
            />
          </View>
        </View>

        <ProfileNavPill
          icon="arrow.right.square.fill"
          label="Sign out"
          onPress={handleSignOut}
          showChevron={false}
          style={styles.signOutButton}
        />
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  card: {
    marginBottom: Spacing.xl,
  },
  identitySection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  identityContent: {
    flex: 1,
    marginLeft: Spacing.md,
    minWidth: 0,
  },
  profileName: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  profileUsername: {
    ...Typography.muted,
    marginBottom: Spacing.xs,
  },
  profilePictureHint: {
    ...Typography.mutedSmall,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  socialText: {
    ...Typography.muted,
  },
  socialNumber: {
    fontWeight: '600',
  },
  socialSeparator: {
    ...Typography.muted,
    marginHorizontal: Spacing.sm,
  },
  sportsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  sportChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  sportChipText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  sportPlayStyleLine: {
    ...Typography.muted,
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  statsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  statsBadgeIcon: {
    marginRight: 4,
  },
  statsBadgeText: {
    ...Typography.mutedSmall,
    fontSize: 12,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  label: {
    ...Typography.muted,
    marginBottom: Spacing.sm,
  },
  value: {
    ...Typography.body,
  },
  pressed: {
    opacity: 0.6,
  },
  hint: {
    ...Typography.mutedSmall,
    marginTop: Spacing.xs,
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  playStyleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  playStyleButton: {
    // Size handled by Button component
  },
  customPlayStyleContainer: {
    marginTop: Spacing.md,
  },
  customPlayStyleInput: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    minHeight: 44,
    marginBottom: Spacing.xs,
  },
  charCount: {
    ...Typography.mutedSmall,
    textAlign: 'right',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  halfButton: {
    flex: 1,
  },
  buttonSpacing: {
    width: Spacing.md,
  },
  emptyState: {
    padding: Spacing.lg,
    borderRadius: 12,
    marginBottom: Spacing.xl,
  },
  emptyStateText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  navPillsGrid: {
    marginBottom: Spacing.lg,
  },
  navPillsRow: {
    flexDirection: 'row',
  },
  navPillHalf: {
    flex: 1,
  },
  navPillGap: {
    width: Spacing.md,
  },
  signOutButton: {
    marginTop: Spacing.sm,
  },
});
