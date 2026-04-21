import { useEffect, useState, useRef } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { OnboardingProgress } from '@/components/onboarding/OnboardingProgress';
import { RecommendedFriendItem } from '@/components/RecommendedFriendItem';
import { Spacing } from '@/constants/theme';
import { useOnboardingExit } from '@/hooks/use-onboarding-exit';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { logDevError } from '@/lib/dev-log';

const FRIENDS_QUERY_LIMIT = 15;
const ONBOARDING_FRIENDS_SHOW = 8;

type RecommendedFriend = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  rep_level: string | null;
  created_at: string;
};

async function fetchOnboardingAthleteSuggestions(userId: string): Promise<RecommendedFriend[]> {
  let followingIds = new Set<string>();
  try {
    const { data: followingData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);
    followingIds = new Set((followingData ?? []).map((f) => f.following_id));
  } catch {
    followingIds = new Set();
  }

  const excludeIds = [userId, ...followingIds];

  try {
    const primary = await supabase
      .from('profiles')
      .select('user_id, name, username, avatar_url, rep_level, created_at')
      .not('user_id', 'in', `(${excludeIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(FRIENDS_QUERY_LIMIT);

    if (!primary.error && primary.data?.length) {
      return primary.data as RecommendedFriend[];
    }
  } catch {
    /* fall through */
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, name, username, avatar_url, rep_level, created_at')
    .neq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(FRIENDS_QUERY_LIMIT);

  if (error || !data?.length) return [];
  return (data as RecommendedFriend[]).filter(
    (p) => p.user_id !== userId && !followingIds.has(p.user_id)
  );
}

export default function OnboardingPlayersScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { exitToHome } = useOnboardingExit();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [phase, setPhase] = useState<'checking' | 'ready'>('checking');
  const [friends, setFriends] = useState<RecommendedFriend[]>([]);
  const redirected = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchOnboardingAthleteSuggestions(user.id);
        if (cancelled) return;
        if (list.length === 0) {
          if (!redirected.current) {
            redirected.current = true;
            router.replace('/onboarding/done' as any);
          }
          return;
        }
        setFriends(list.slice(0, ONBOARDING_FRIENDS_SHOW));
        setPhase('ready');
      } catch (e) {
        logDevError('onboarding/players', e);
        if (!cancelled && !redirected.current) {
          redirected.current = true;
          router.replace('/onboarding/done' as any);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, router]);

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

  if (phase === 'checking') {
    return <LoadingScreen message="Loading suggestions…" />;
  }

  return (
    <Screen>
      <Header
        title="Follow some players"
        subtitle="Follow a few people to see highlights and activity in your feed."
        showBack={false}
        rightElement={skipButton}
      />
      <OnboardingProgress current={4} total={5} />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: scrollBottomPadding }]}
        showsVerticalScrollIndicator={false}
      >
        {friends.map((friend) => (
          <View key={friend.user_id} style={styles.row}>
            <RecommendedFriendItem
              userId={friend.user_id}
              name={friend.name}
              username={friend.username}
              avatarUrl={friend.avatar_url}
              tierRepLevel={friend.rep_level}
              subtitle="Suggested"
              onPress={() => router.push(`/athletes/${friend.user_id}/profile` as any)}
            />
          </View>
        ))}
        <Button title="Continue" onPress={() => router.push('/onboarding/done' as any)} variant="primary" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipLabel: { paddingTop: 4 },
  scroll: { gap: Spacing.md },
  row: { marginBottom: Spacing.sm },
});
