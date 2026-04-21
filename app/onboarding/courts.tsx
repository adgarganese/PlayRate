import { useEffect, useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { AppText } from '@/components/ui/AppText';
import { TextInput } from '@/components/ui/TextInput';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { Spacing } from '@/constants/theme';
import { useThemeColors } from '@/contexts/theme-context';
import { fetchCourtsNearbyRpc, type CourtNearby } from '@/lib/courts-nearby-rpc';
import { fetchCourts } from '@/lib/courts-api';
import { getFollowedCourtIds } from '@/lib/court-follows';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { UI_FOLLOW_FAILED } from '@/lib/user-facing-errors';
import { useOnboardingExit } from '@/hooks/use-onboarding-exit';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

function formatDistanceMeters(m: number): string {
  if (!Number.isFinite(m)) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export default function OnboardingCourtsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { exitToHome } = useOnboardingExit();
  const scrollBottomPadding = useScrollContentBottomPadding();

  const [permission, setPermission] = useState<Location.PermissionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [courts, setCourts] = useState<CourtNearby[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [cityQuery, setCityQuery] = useState('');
  const [searchingCity, setSearchingCity] = useState(false);
  const [rpcFailed, setRpcFailed] = useState(false);

  const syncFollowedFromCourts = useCallback((list: CourtNearby[]) => {
    setFollowedIds(new Set(list.filter((c) => c.isFollowed).map((c) => c.id)));
  }, []);

  const loadNearbyWithCoordsStable = useCallback(
    async (lat: number, lng: number) => {
      setLoading(true);
      setRpcFailed(false);
      try {
        const list = await fetchCourtsNearbyRpc(lat, lng, user?.id, 25_000);
        setCourts(list);
        syncFollowedFromCourts(list);
      } catch (e) {
        if (__DEV__) logger.warn('[onboarding/courts] load failed', { err: e });
        setRpcFailed(true);
        setCourts([]);
        setFollowedIds(new Set());
      } finally {
        setLoading(false);
      }
    },
    [user?.id, syncFollowedFromCourts]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      setPermission(status);
      if (status !== 'granted') {
        setLoading(false);
        setCourts([]);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await loadNearbyWithCoordsStable(loc.coords.latitude, loc.coords.longitude);
      } catch (e) {
        if (__DEV__) logger.warn('[onboarding/courts] location', { err: e });
        if (!cancelled) {
          setLoading(false);
          setCourts([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadNearbyWithCoordsStable]);

  const skipButton = (
    <TouchableOpacity
      onPress={() => void exitToHome()}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      accessibilityRole="button"
      accessibilityLabel="Skip onboarding"
    >
      <AppText variant="muted" color="primary" style={styles.skipLabel}>
        Skip
      </AppText>
    </TouchableOpacity>
  );

  const runCitySearch = async () => {
    const q = cityQuery.trim();
    if (!q || !user) return;
    setSearchingCity(true);
    setRpcFailed(false);
    try {
      const list = await fetchCourts(user.id, q);
      const withMeta = list.map((c) => ({ ...c, distance_meters: undefined } as CourtNearby));
      const followed = await getFollowedCourtIds(user.id);
      setFollowedIds(followed);
      setCourts(
        withMeta.map((c) => ({
          ...c,
          isFollowed: followed.has(c.id),
        }))
      );
    } catch (e) {
      if (__DEV__) logger.warn('[onboarding/courts] city search', { err: e });
      Alert.alert('Error', "We couldn't search courts. Try again.");
    } finally {
      setSearchingCity(false);
    }
  };

  const toggleFollowCourt = async (courtId: string) => {
    if (!user) return;
    hapticLight();
    const was = followedIds.has(courtId);
    const snapshotFollowed = new Set(followedIds);
    const next = new Set(followedIds);
    if (was) next.delete(courtId);
    else next.add(courtId);
    setFollowedIds(next);
    setCourts((prev) =>
      prev.map((c) => (c.id === courtId ? { ...c, isFollowed: !was } : c))
    );

    try {
      if (was) {
        const { error } = await supabase
          .from('court_follows')
          .delete()
          .eq('user_id', user.id)
          .eq('court_id', courtId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('court_follows').insert({
          user_id: user.id,
          court_id: courtId,
        });
        if (error) {
          if (error.code === '23505') return;
          throw error;
        }
      }
    } catch {
      setFollowedIds(snapshotFollowed);
      setCourts((prev) => prev.map((c) => (c.id === courtId ? { ...c, isFollowed: was } : c)));
      Alert.alert('Error', UI_FOLLOW_FAILED);
    }
  };

  const retryLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermission(status);
    if (status !== 'granted') return;
    setLoading(true);
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await loadNearbyWithCoordsStable(loc.coords.latitude, loc.coords.longitude);
    } catch (e) {
      if (__DEV__) logger.warn('[onboarding/courts] retry location', { err: e });
      setLoading(false);
    }
  };

  const showLocationDenied = permission !== null && permission !== 'granted';
  const showCitySearchFallback =
    showLocationDenied ||
    (permission === 'granted' && !loading && rpcFailed) ||
    (permission === 'granted' && !loading && !rpcFailed && courts.length === 0);

  return (
    <Screen>
      <Header
        title="Find courts near you"
        subtitle="Follow courts you play at to personalize runs and your feed."
        showBack={false}
        rightElement={skipButton}
      />
      <OnboardingProgress current={3} total={5} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {showCitySearchFallback && (
          <Card style={styles.card}>
            <AppText variant="muted" color="textMuted" style={styles.fallbackCopy}>
              {showLocationDenied
                ? 'Location is off. Search by city or skip — you can always find courts from the Courts tab.'
                : rpcFailed
                  ? 'Nearby search had a problem. Try finding a court by name or city below.'
                  : 'No courts in GPS range yet. Search by city or name, or add a new court below.'}
            </AppText>
            <View style={styles.cityRow}>
              <TextInput
                value={cityQuery}
                onChangeText={setCityQuery}
                placeholder="City or court name"
                autoCapitalize="words"
                style={styles.cityInput}
              />
              <Button
                title={searchingCity ? '…' : 'Search'}
                onPress={() => void runCitySearch()}
                variant="secondary"
                size="medium"
                disabled={searchingCity || !cityQuery.trim()}
              />
            </View>
            {(showLocationDenied || rpcFailed) && (
              <Button title="Try location again" onPress={() => void retryLocation()} variant="primary" size="small" />
            )}
          </Card>
        )}

        {permission === 'granted' && loading && (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <AppText variant="muted" color="textMuted" style={styles.loadingLabel}>
              Finding nearby courts…
            </AppText>
          </View>
        )}

        {!loading &&
          courts.map((court) => (
            <Card key={court.id} style={styles.card}>
              <View style={styles.courtRow}>
                <View style={styles.courtText}>
                  <AppText variant="bodyBold" color="text" numberOfLines={2}>
                    {court.name}
                  </AppText>
                  {court.address ? (
                    <AppText variant="muted" color="textMuted" numberOfLines={2}>
                      {court.address}
                    </AppText>
                  ) : null}
                  {court.distance_meters != null ? (
                    <AppText variant="mutedSmall" color="textMuted">
                      {formatDistanceMeters(court.distance_meters)} away
                    </AppText>
                  ) : null}
                </View>
                <Button
                  title={followedIds.has(court.id) ? 'Following' : 'Follow'}
                  onPress={() => void toggleFollowCourt(court.id)}
                  variant={followedIds.has(court.id) ? 'secondary' : 'primary'}
                  size="small"
                />
              </View>
            </Card>
          ))}

        <Button
          title="Add a court"
          onPress={() => router.push('/courts/new')}
          variant="secondary"
          style={styles.addCourt}
        />
        <Button title="Continue" onPress={() => router.push('/onboarding/players' as any)} variant="primary" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipLabel: { paddingTop: 4 },
  scroll: { gap: Spacing.md },
  card: { marginBottom: 0 },
  fallbackCopy: { marginBottom: Spacing.md },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cityInput: { flex: 1 },
  center: { paddingVertical: Spacing.xl, alignItems: 'center' },
  loadingLabel: { marginTop: Spacing.sm },
  courtRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  courtText: { flex: 1, minWidth: 0 },
  addCourt: { marginTop: Spacing.sm },
});
