import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import { AthleteListSkeleton } from '@/components/skeletons/AthleteListSkeleton';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Screen } from './ui/Screen';
import { Header } from './ui/Header';
import { ListItem } from './ui/ListItem';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { isSportEnabled } from '@/constants/sport-definitions';
import { UI_LOAD_FAILED } from '@/lib/user-facing-errors';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmptyAthletesIllustration } from '@/components/illustrations';

type Profile = {
  user_id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  sports: string[];
  play_style: string | null;
};

const PAGE_SIZE = 24;
const SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;

/** Escape % and _ for PostgREST ilike patterns. */
function escapeIlikePattern(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function attachSportsToProfiles(
  profilesData: { user_id: string; name: string | null; username: string | null; bio: string | null; play_style: string | null }[]
): Promise<Profile[]> {
  if (profilesData.length === 0) return [];
  const profileIds = profilesData.map((p) => p.user_id);
  const { data: profileSportsData } = await supabase
    .from('profile_sports')
    .select('profile_id, sport:sports(name)')
    .in('profile_id', profileIds);

  const sportsByProfile: Record<string, string[]> = {};
  profileSportsData?.forEach((ps: { profile_id: string; sport: { name?: string } | { name?: string }[] | null }) => {
    if (!sportsByProfile[ps.profile_id]) {
      sportsByProfile[ps.profile_id] = [];
    }
    const sport = Array.isArray(ps.sport) ? ps.sport[0] : ps.sport;
    if (sport?.name) {
      sportsByProfile[ps.profile_id].push(sport.name);
    }
  });

  return profilesData.map((profile) => ({
    ...profile,
    sports: sportsByProfile[profile.user_id] || [],
    play_style: profile.play_style ?? null,
  }));
}

export default function Profiles() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const [baseProfiles, setBaseProfiles] = useState<Profile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const nextPageRef = useRef(0);
  const searchReqId = useRef(0);
  const loadingMoreRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const trimmedSearch = searchQuery.trim();
  const isSearchActive = trimmedSearch.length > 0;
  const displayProfiles = isSearchActive ? searchResults : baseProfiles;

  useEffect(() => {
    let cancelled = false;
    nextPageRef.current = 0;
    setHasMore(true);
    setError(null);
    setLoadingInitial(true);

    void (async () => {
      try {
        const from = 0;
        const to = PAGE_SIZE - 1;
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name, username, bio, play_style')
          .order('user_id', { ascending: true })
          .range(from, to);

        if (cancelled) return;

        if (profilesError) {
          setError(profilesError.message);
          setBaseProfiles([]);
          setHasMore(false);
          return;
        }

        if (!profilesData || profilesData.length === 0) {
          setBaseProfiles([]);
          setHasMore(false);
          return;
        }

        const profilesWithSports = await attachSportsToProfiles(profilesData);
        if (cancelled) return;

        setBaseProfiles(profilesWithSports);
        nextPageRef.current = 1;
        setHasMore(profilesData.length >= PAGE_SIZE);
      } catch {
        if (!cancelled) {
          setError(UI_LOAD_FAILED);
          setBaseProfiles([]);
          setHasMore(false);
        }
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isSearchActive) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    const q = trimmedSearch;
    const escaped = escapeIlikePattern(q);
    const reqId = ++searchReqId.current;
    setSearchLoading(true);

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('user_id, name, username, bio, play_style')
            .or(`username.ilike.%${escaped}%,name.ilike.%${escaped}%`)
            .limit(SEARCH_LIMIT);

          if (searchReqId.current !== reqId) return;

          if (profilesError) {
            setError(profilesError.message);
            setSearchResults([]);
            return;
          }

          if (!profilesData?.length) {
            setSearchResults([]);
            return;
          }

          const profilesWithSports = await attachSportsToProfiles(profilesData);
          if (searchReqId.current !== reqId) return;
          setSearchResults(profilesWithSports);
        } catch {
          if (searchReqId.current === reqId) {
            setError(UI_LOAD_FAILED);
            setSearchResults([]);
          }
        } finally {
          if (searchReqId.current === reqId) {
            setSearchLoading(false);
          }
        }
      })();
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedSearch, isSearchActive]);

  const handleLoadMore = useCallback(async () => {
    if (isSearchActive || !hasMore || loadingInitial || loadingMoreRef.current) return;

    loadingMoreRef.current = true;
    setLoadingMore(true);
    if (mountedRef.current) setError(null);

    try {
      const page = nextPageRef.current;
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, play_style')
        .order('user_id', { ascending: true })
        .range(from, to);

      if (profilesError) {
        if (mountedRef.current) setError(profilesError.message);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        if (mountedRef.current) setHasMore(false);
        return;
      }

      const profilesWithSports = await attachSportsToProfiles(profilesData);
      if (!mountedRef.current) return;
      setBaseProfiles((prev) => [...prev, ...profilesWithSports]);
      nextPageRef.current = page + 1;
      setHasMore(profilesData.length >= PAGE_SIZE);
    } catch {
      if (mountedRef.current) setError(UI_LOAD_FAILED);
    } finally {
      loadingMoreRef.current = false;
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [isSearchActive, hasMore, loadingInitial]);

  const handleProfilePress = (userId: string) => {
    router.push(`/athletes/${userId}/profile` as any);
  };

  const listLoading = isSearchActive ? searchLoading : loadingInitial && baseProfiles.length === 0;
  const showListSkeleton = listLoading;

  return (
    <Screen>
      <Header title="Athletes" showBack={false} />
      <View style={styles.searchContainer}>
        <RNTextInput
          style={[
            styles.searchInput,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Search athletes"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Search athletes"
          returnKeyType="search"
        />
      </View>

      {error && !showListSkeleton && displayProfiles.length === 0 ? (
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
        </View>
      ) : showListSkeleton ? (
        <AthleteListSkeleton />
      ) : (
        <FlatList
          contentContainerStyle={styles.listContainer}
          data={displayProfiles}
          keyExtractor={(item) => item.user_id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          renderItem={({ item }) => (
            <ListItem
              title={item.name ?? 'No name yet'}
              subtitle={`@${item.username ?? 'no-username'}`}
              metadataLine={item.sports.filter(isSportEnabled).join(', ') || undefined}
              showChevron
              onPress={() => handleProfilePress(item.user_id)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title={isSearchActive ? 'No athletes found' : 'No athletes yet.'}
              subtitle={isSearchActive ? 'Try adjusting your search terms' : 'Be the first to join!'}
              illustration={<EmptyAthletesIllustration />}
            />
          }
          ListFooterComponent={
            !isSearchActive && loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  errorTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  errorText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchInput: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    padding: Spacing.md,
    minHeight: 44,
  },
  listContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  footerLoading: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
