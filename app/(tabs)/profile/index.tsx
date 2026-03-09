import { useEffect, useState } from 'react';
import { View, Text, Alert, StyleSheet, TextInput as RNTextInput, Pressable, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { useFollow } from '@/hooks/useFollow';
import { KeyboardScreen } from '@/components/ui/KeyboardScreen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { ProfilePicture } from '@/components/ProfilePicture';
import { ProfileNavPill } from '@/components/ProfileNavPill';
import { NotificationsAndInboxIcons } from '@/components/NotificationsAndInboxIcons';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getPlayStylesForSport, isSportEnabled } from '@/constants/sport-definitions';

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

export default function ProfileScreen() {
  const { user, loading: authLoading } = useAuth();
  const { followersCount, followingCount } = useFollow(user?.id ?? null);
  const router = useRouter();
  const { colors } = useThemeColors();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [, setActiveSportId] = useState<string | null>(null);
  const [activeSportName, setActiveSportName] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', bio: '', playStyle: '' });
  const [customPlayStyle, setCustomPlayStyle] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [cosignCount, setCosignCount] = useState(0);
  const [checkInsCount, setCheckInsCount] = useState(0);
  const [ratingsCount, setRatingsCount] = useState(0);
  const [highlightsCount, setHighlightsCount] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setTimeout(() => router.replace('/sign-in'), 100);
      return;
    }
    loadProfile();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const loadProfile = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, play_style, avatar_url, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        if (error.message?.includes('avatar_url')) {
          const { data: d } = await supabase.from('profiles').select('user_id, name, username, bio, created_at').eq('user_id', user.id).maybeSingle();
          if (d) {
            setProfile({ ...d, avatar_url: null, play_style: null });
            setFormData({ name: d.name || '', bio: d.bio || '', playStyle: '' });
          }
        } else {
          Alert.alert('Error', 'Unable to load your profile.');
        }
        setLoading(false);
        return;
      }

      if (!data) {
        Alert.alert('Profile Not Found', 'Your profile was not found.');
        setLoading(false);
        return;
      }

      setProfile(data);
      setAvatarUrl(data.avatar_url || null);

      const { data: currentProfile } = await supabase.from('profiles').select('active_sport_id').eq('user_id', user.id).maybeSingle();
      let sportName: string | null = null;
      if (currentProfile?.active_sport_id) {
        const { data: sportData } = await supabase.from('sports').select('name').eq('id', currentProfile.active_sport_id).maybeSingle();
        sportName = sportData?.name || null;
        if (sportName && !isSportEnabled(sportName)) {
          sportName = 'Basketball';
        }
        setActiveSportId(currentProfile.active_sport_id);
        setActiveSportName(sportName);
      }

      let playStyle: string | null = null;
      if (currentProfile?.active_sport_id) {
        try {
          const { data: sp } = await supabase.from('sport_profiles').select('play_style').eq('user_id', user.id).eq('sport_id', currentProfile.active_sport_id).maybeSingle();
          playStyle = sp?.play_style || null;
        } catch (error) {
          if (__DEV__) console.warn('[profile-tab:load] sport_profiles', error);
          playStyle = data.play_style || null;
        }
      }
      if (!playStyle) playStyle = data.play_style || null;

      const opts = sportName ? getPlayStylesForSport(sportName) : getPlayStylesForSport('Basketball');
      const ps = playStyle || '';
      setFormData({
        name: data.name || '',
        bio: data.bio || '',
        playStyle: opts.includes(ps as never) ? ps : (ps ? PLAY_STYLE_CUSTOM : ''),
      });
      setCustomPlayStyle(opts.includes(ps as never) ? '' : ps);

      // Stats for credibility card (non-blocking)
      try {
        const { data: profileCosign } = await supabase.from('profiles').select('cosign_count').eq('user_id', user.id).maybeSingle();
        if (profileCosign?.cosign_count != null) {
          setCosignCount(profileCosign.cosign_count);
        } else {
          const { count: c } = await supabase.from('cosigns').select('*', { count: 'exact', head: true }).eq('to_user_id', user.id);
          setCosignCount(c ?? 0);
        }
        const { count: checkIns } = await supabase.from('check_ins').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setCheckInsCount(checkIns ?? 0);
        const { count: ratings } = await supabase.from('self_ratings').select('*', { count: 'exact', head: true }).eq('profile_id', user.id);
        setRatingsCount(ratings ?? 0);
        const { count: highlights } = await supabase.from('highlights').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
        setHighlightsCount(highlights ?? 0);
      } catch (error) {
        if (__DEV__) console.warn('[profile-tab:load] highlightsCount', error);
      }
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !profile) return;
    const playStyleValue = formData.playStyle === PLAY_STYLE_CUSTOM ? (customPlayStyle.trim() || null) : (formData.playStyle || null);
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ name: formData.name || null, bio: formData.bio || null }).eq('user_id', user.id);
    if (error) {
      setSaving(false);
      Alert.alert('Error', 'Unable to save.');
      return;
    }
    const { data: cp } = await supabase.from('profiles').select('active_sport_id').eq('user_id', user.id).maybeSingle();
    if (cp?.active_sport_id) {
      await supabase.from('sport_profiles').upsert({ user_id: user.id, sport_id: cp.active_sport_id, play_style: playStyleValue, updated_at: new Date().toISOString() }, { onConflict: 'user_id,sport_id' });
    }
    if (playStyleValue) await supabase.from('profiles').update({ play_style: playStyleValue }).eq('user_id', user.id);
    setSaving(false);
    Alert.alert('Saved', 'Your profile has been updated!');
    setEditing(false);
    await loadProfile();
  };

  if (authLoading || loading) return <LoadingScreen message="Loading profile..." />;
  if (!user || !profile) return <ErrorScreen message="Profile not found" onRetry={loadProfile} retryLabel="Retry" />;

  const subtitle = profile.bio?.trim() || profile.play_style || (activeSportName ? `${activeSportName} player` : null) || 'Add a short bio';

  return (
    <KeyboardScreen contentContainerStyle={styles.scrollContent}>
      <Header
        title="Profile"
        rightElement={
          <View style={styles.headerRight}>
            <NotificationsAndInboxIcons />
            <TouchableOpacity
              onPress={() => router.push('/profile/account' as any)}
              accessibilityLabel="Account & Security"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.headerIconButton, { zIndex: 11, marginLeft: Spacing.sm }]}
            >
              <IconSymbol name="gearshape.fill" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        }
      />

      {/* Hero: avatar + name + @username + subtitle */}
      <Card style={styles.heroCard}>
        <View style={styles.heroTop}>
          <ProfilePicture
            avatarUrl={avatarUrl}
            size={96}
            editable
            onUpdate={(u) => { setAvatarUrl(u); if (profile) setProfile({ ...profile, avatar_url: u }); loadProfile(); }}
          />
          <View style={styles.heroTextWrap}>
            <Text style={[styles.heroName, { color: colors.text }]} numberOfLines={1}>
              {profile.name || 'Add your name'}
            </Text>
            <Text style={[styles.heroUsername, { color: colors.textMuted }]} numberOfLines={1}>
              @{profile.username}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {subtitle}
            </Text>
            <Text style={[styles.avatarHint, { color: colors.textMuted }]}>Tap avatar to change</Text>
          </View>
        </View>

        {/* Stats row: Followers | Following | Highlights */}
        <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
          <Pressable
            onPress={() => router.push(`/athletes/${user.id}/followers` as any)}
            style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>{formatCount(followersCount)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Followers</Text>
          </Pressable>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => router.push(`/athletes/${user.id}/following` as any)}
            style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>{formatCount(followingCount)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Following</Text>
          </Pressable>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => router.push('/profile/highlights' as any)}
            style={({ pressed }) => [styles.statBlock, pressed && styles.pressed]}
            hitSlop={8}
          >
            <Text style={[styles.statNumber, { color: colors.text }]}>{formatCount(highlightsCount)}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Highlights</Text>
          </Pressable>
        </View>
      </Card>

      {/* Action pills: Edit Profile, My Sports, My Highlights, Rate Yourself */}
      <View style={styles.pillsRow}>
        <ProfileNavPill
          icon="pencil"
          label="Edit Profile"
          onPress={() => setEditing(true)}
          showChevron={false}
          style={styles.pill}
        />
        <ProfileNavPill
          icon="sportscourt.fill"
          label="My Sports"
          onPress={() => router.push('/my-sports')}
          showChevron={false}
          style={styles.pill}
        />
        <ProfileNavPill
          icon="play.rectangle.fill"
          label="My Highlights"
          onPress={() => router.push('/profile/highlights' as any)}
          showChevron={false}
          style={styles.pill}
        />
        <ProfileNavPill
          icon="star.fill"
          label="Rate Yourself"
          onPress={() => router.push('/self-ratings')}
          showChevron={false}
          style={styles.pill}
        />
      </View>

      {/* About card (view) or Edit form (editing) */}
      <Card style={styles.contentCard}>
        {editing ? (
          <>
            <View style={styles.section}>
              <TextInput label="Name" placeholder="Enter your name" value={formData.name} onChangeText={(t) => setFormData({ ...formData, name: t })} editable={!saving} />
            </View>
            <View style={styles.section}>
              <TextInput label="Bio" placeholder="Tell us about yourself" value={formData.bio} onChangeText={(t) => setFormData({ ...formData, bio: t })} multiline numberOfLines={4} editable={!saving} style={styles.bioInput} />
            </View>
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.textMuted }]}>Play Style</Text>
              <View style={styles.playStyleGrid}>
                {(activeSportName ? getPlayStylesForSport(activeSportName) : getPlayStylesForSport('Basketball')).map((o) => (
                  <Button key={o} title={o} onPress={() => setFormData({ ...formData, playStyle: o })} variant={formData.playStyle === o ? 'primary' : 'secondary'} size="medium" disabled={saving} style={styles.playStyleButton} />
                ))}
                <Button title={PLAY_STYLE_CUSTOM} onPress={() => setFormData({ ...formData, playStyle: PLAY_STYLE_CUSTOM })} variant={formData.playStyle === PLAY_STYLE_CUSTOM ? 'primary' : 'secondary'} size="medium" disabled={saving} style={styles.playStyleButton} />
              </View>
              {formData.playStyle === PLAY_STYLE_CUSTOM && (
                <View style={styles.customPlayStyleContainer}>
                  <RNTextInput style={[styles.customPlayStyleInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholder="Custom play style (max 24)" placeholderTextColor={colors.textMuted} value={customPlayStyle} onChangeText={(t) => t.length <= 24 && setCustomPlayStyle(t)} editable={!saving} maxLength={24} />
                  <Text style={[styles.charCount, { color: colors.textMuted }]}>{customPlayStyle.length}/24</Text>
                </View>
              )}
            </View>
            <View style={styles.buttonRow}>
              <Button title="Cancel" onPress={() => { setEditing(false); const cp = profile.play_style || ''; const opts = activeSportName ? getPlayStylesForSport(activeSportName) : getPlayStylesForSport('Basketball'); setFormData({ name: profile.name || '', bio: profile.bio || '', playStyle: opts.includes(cp as never) ? cp : (cp ? PLAY_STYLE_CUSTOM : '') }); setCustomPlayStyle(opts.includes(cp as never) ? '' : cp); }} variant="secondary" disabled={saving} style={styles.halfButton} />
              <View style={styles.buttonSpacing} />
              <Button title="Save" onPress={handleSave} variant="primary" loading={saving} disabled={saving} style={styles.halfButton} />
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.cardTitle, { color: colors.textMuted }]}>About</Text>
            {(profile.bio || profile.play_style) ? (
              <View style={styles.aboutBody}>
                {profile.bio ? <Text style={[styles.aboutText, { color: colors.text }]}>{profile.bio}</Text> : null}
                {profile.play_style ? <Text style={[styles.aboutMeta, { color: colors.textMuted }]}>Play style · {profile.play_style}</Text> : null}
              </View>
            ) : (
              <Text style={[styles.aboutEmpty, { color: colors.textMuted }]}>Your profile is empty. Tap Edit Profile to add a bio and play style.</Text>
            )}
          </>
        )}
      </Card>

      {/* Stats / Credibility card */}
      <Card style={styles.contentCard}>
        <Text style={[styles.cardTitle, { color: colors.textMuted }]}>Stats</Text>
        <View style={styles.credibilityRow}>
          <View style={styles.credibilityItem}>
            <Text style={[styles.credibilityNumber, { color: colors.text }]}>{formatCount(cosignCount)}</Text>
            <Text style={[styles.credibilityLabel, { color: colors.textMuted }]}>Cosigns</Text>
          </View>
          <View style={[styles.credibilityDivider, { backgroundColor: colors.border }]} />
          <View style={styles.credibilityItem}>
            <Text style={[styles.credibilityNumber, { color: colors.text }]}>{formatCount(checkInsCount)}</Text>
            <Text style={[styles.credibilityLabel, { color: colors.textMuted }]}>Check-ins</Text>
          </View>
          <View style={[styles.credibilityDivider, { backgroundColor: colors.border }]} />
          <View style={styles.credibilityItem}>
            <Text style={[styles.credibilityNumber, { color: colors.text }]}>{formatCount(ratingsCount)}</Text>
            <Text style={[styles.credibilityLabel, { color: colors.textMuted }]}>Ratings</Text>
          </View>
        </View>
      </Card>
    </KeyboardScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: Spacing.xl },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  headerIconButton: { padding: Spacing.sm, marginTop: -Spacing.sm },
  heroCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', paddingBottom: Spacing.lg },
  heroTextWrap: { flex: 1, marginLeft: Spacing.lg, minWidth: 0 },
  heroName: { ...Typography.h2, marginBottom: 2 },
  heroUsername: { ...Typography.body, marginBottom: 2 },
  heroSubtitle: { ...Typography.muted, marginBottom: 2 },
  avatarHint: { ...Typography.mutedSmall },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingTop: Spacing.lg, borderTopWidth: 1 },
  statBlock: { alignItems: 'center', minWidth: 80 },
  statNumber: { ...Typography.h3 },
  statLabel: { ...Typography.mutedSmall, marginTop: 2 },
  statDivider: { width: 1, height: 28 },
  pressed: { opacity: 0.6 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  pill: { flex: 1, minWidth: 100 },
  contentCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.mutedSmall, marginBottom: Spacing.md, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { marginBottom: Spacing.lg },
  label: { ...Typography.muted, marginBottom: Spacing.sm },
  value: { ...Typography.body },
  aboutBody: { gap: Spacing.xs },
  aboutText: { ...Typography.body },
  aboutMeta: { ...Typography.mutedSmall, marginTop: Spacing.sm },
  aboutEmpty: { ...Typography.muted },
  credibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  credibilityItem: { alignItems: 'center' },
  credibilityNumber: { ...Typography.h3 },
  credibilityLabel: { ...Typography.mutedSmall, marginTop: 2 },
  credibilityDivider: { width: 1, height: 28 },
  bioInput: { minHeight: 100, textAlignVertical: 'top' },
  playStyleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.sm },
  playStyleButton: {},
  customPlayStyleContainer: { marginTop: Spacing.md },
  customPlayStyleInput: { ...Typography.body, borderWidth: 1, borderRadius: Radius.sm, padding: Spacing.md, minHeight: 44, marginBottom: Spacing.xs },
  charCount: { ...Typography.mutedSmall, textAlign: 'right' },
  buttonRow: { flexDirection: 'row', marginTop: Spacing.md },
  halfButton: { flex: 1 },
  buttonSpacing: { width: Spacing.md },
});
