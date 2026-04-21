import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  TextInput as RNTextInput,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
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
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyAthletesIllustration } from '@/components/illustrations';
import { logger } from '@/lib/logger';
import { escapeIlikePattern } from '@/lib/ilike-escape';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

type Profile = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  rep_level: string | null;
  active_sport_id: string | null;
  sports: string[];
};

type ProfileRow = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
  rep_level: string | null;
  active_sport_id: string | null;
  profile_sports: ProfileSportJoin[] | null;
};

type ProfileSportJoin = {
  sport: { name?: string } | { name?: string }[] | null;
};

const PAGE_SIZE = 24;
const SEARCH_LIMIT = 50;
const SEARCH_DEBOUNCE_MS = 300;
const STALE_MS = 30_000;
const SLOW_LOAD_HINT_MS = 5000;

/** Single round-trip: list fields + sports via FK embed (avoids sequential profile_sports query). */
const PROFILE_LIST_SELECT = `
  user_id,
  name,
  username,
  avatar_url,
  rep_level,
  active_sport_id,
  profile_sports (
    sport:sports (
      name
    )
  )
`;

function mapEmbedToProfiles(rows: ProfileRow[]): Profile[] {
  return rows.map((row) => {
    const sports: string[] = [];
    for (const ps of row.profile_sports ?? []) {
      const sport = Array.isArray(ps.sport) ? ps.sport[0] : ps.sport;
      if (sport?.name) sports.push(sport.name);
    }
    return {
      user_id: row.user_id,
      name: row.name,
      username: row.username,
      avatar_url: row.avatar_url,
      rep_level: row.rep_level ?? null,
      active_sport_id: row.active_sport_id,
      sports,
    };
  });
}

export default function Profiles() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [baseProfiles, setBaseProfiles] = useState<Profile[]>([]);
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [slowLoadHint, setSlowLoadHint] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const nextPageRef = useRef(0);
  const searchReqId = useRef(0);
  const loadingMoreRef = useRef(false);
  const mountedRef = useRef(true);
  const lastSuccessfulFetchAt = useRef<number | null>(null);
  const firstPageInFlightRef = useRef(false);
  const baseProfilesLengthRef = useRef(0);
  const searchActiveRef = useRef(false);

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
    searchActiveRef.current = isSearchActive;
  }, [isSearchActive]);

  useEffect(() => {
    baseProfilesLengthRef.current = baseProfiles.length;
  }, [baseProfiles.length]);

  const runFirstPageFetch = useCallback(async (options?: { silent?: boolean }) => {
    if (firstPageInFlightRef.current) return;
    firstPageInFlightRef.current = true;
    const silent = options?.silent ?? false;
    let slowTimer: ReturnType<typeof setTimeout> | undefined;

    try {
      if (!silent) {
        setLoadingInitial(true);
        setError(null);
        setSlowLoadHint(false);
        slowTimer = setTimeout(() => {
          if (mountedRef.current) setSlowLoadHint(true);
        }, SLOW_LOAD_HINT_MS);
      }

      const from = 0;
      const to = PAGE_SIZE - 1;
      const { data, error: profilesError } = await supabase
        .from('profiles')
        .select(PROFILE_LIST_SELECT)
        .order('user_id', { ascending: true })
        .range(from, to);

      if (!mountedRef.current) return;

      if (profilesError) {
        logger.error('[athletes-list] profiles query failed', { err: profilesError, silent });
        if (!silent) {
          setError(profilesError.message);
          setBaseProfiles([]);
        }
        setHasMore(false);
        return;
      }

      const rows = (data ?? []) as ProfileRow[];
      if (rows.length === 0) {
        setBaseProfiles([]);
        setHasMore(false);
        lastSuccessfulFetchAt.current = Date.now();
        if (!silent) setError(null);
        return;
      }

      setBaseProfiles(mapEmbedToProfiles(rows));
      nextPageRef.current = 1;
      setHasMore(rows.length >= PAGE_SIZE);
      lastSuccessfulFetchAt.current = Date.now();
      if (!silent) setError(null);
    } catch (err) {
      logger.error('[athletes-list] profiles fetch threw', { err, silent });
      if (mountedRef.current) {
        if (!silent) {
          setError(UI_LOAD_FAILED);
          setBaseProfiles([]);
        }
        setHasMore(false);
      }
    } finally {
      if (slowTimer) clearTimeout(slowTimer);
      if (mountedRef.current) {
        setSlowLoadHint(false);
        if (!silent) setLoadingInitial(false);
      }
      firstPageInFlightRef.current = false;
    }
  }, []);

  // Covers eager tab mounts (screen mounted before first focus); pairs with useFocusEffect for stale refetch.
  useEffect(() => {
    if (lastSuccessfulFetchAt.current !== null) return;
    void runFirstPageFetch({ silent: false });
  }, [runFirstPageFetch]);

  useFocusEffect(
    useCallback(() => {
      if (searchActiveRef.current) return undefined;
      const now = Date.now();
      const last = lastSuccessfulFetchAt.current;
      const len = baseProfilesLengthRef.current;
      if (last === null) return undefined;
      if (now - last > STALE_MS) {
        void runFirstPageFetch({ silent: len > 0 });
      }
      return undefined;
    }, [runFirstPageFetch])
  );

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
            .select(PROFILE_LIST_SELECT)
            .or(`username.ilike.%${escaped}%,name.ilike.%${escaped}%`)
            .limit(SEARCH_LIMIT);

          if (searchReqId.current !== reqId) return;

          if (profilesError) {
            logger.error('[athletes-list] search query failed', { err: profilesError, query: q });
            setError(profilesError.message);
            setSearchResults([]);
            return;
          }

          if (!profilesData?.length) {
            setSearchResults([]);
            return;
          }

          setSearchResults(mapEmbedToProfiles(profilesData as ProfileRow[]));
        } catch (err) {
          logger.error('[athletes-list] search fetch threw', { err, query: q });
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
  }, [trimmedSearch, isSearchActive, retryNonce]);

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
        .select(PROFILE_LIST_SELECT)
        .order('user_id', { ascending: true })
        .range(from, to);

      if (profilesError) {
        logger.error('[athletes-list] load more failed', { err: profilesError });
        if (mountedRef.current) setError(profilesError.message);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        if (mountedRef.current) setHasMore(false);
        return;
      }

      const mapped = mapEmbedToProfiles(profilesData as ProfileRow[]);
      if (!mountedRef.current) return;
      setBaseProfiles((prev) => [...prev, ...mapped]);
      nextPageRef.current = page + 1;
      setHasMore(profilesData.length >= PAGE_SIZE);
    } catch (err) {
      logger.error('[athletes-list] load more threw', { err });
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
          <ErrorState
            onRetry={() => {
              setError(null);
              if (!isSearchActive) void runFirstPageFetch({ silent: false });
              else setRetryNonce((n) => n + 1);
            }}
          />
        </View>
      ) : showListSkeleton ? (
        <AthleteListSkeleton
          hintText={slowLoadHint ? 'Taking longer than expected…' : undefined}
        />
      ) : (
        <FlatList
          contentContainerStyle={[styles.listContainer, { paddingBottom: scrollBottomPadding }]}
          data={displayProfiles}
          keyExtractor={(item) => item.user_id}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.35}
          renderItem={({ item }) => (
            <ListItem
              title={item.name ?? 'No name yet'}
              subtitle={`@${item.username ?? 'no-username'}`}
              metadataLine={item.sports.filter(isSportEnabled).join(', ') || undefined}
              tierRepLevel={item.rep_level}
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
  },
  footerLoading: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
});
