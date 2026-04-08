/**
 * REINTRODUCTION STEP 2: Real Courts screen restored. Highlights, Athletes, Profile remain placeholders.
 * Stable baseline: Home + Courts real; minimal tab shell; no haptics.
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  SectionList,
  StyleSheet,
  RefreshControl,
  TextInput as RNTextInput,
  TouchableOpacity,
  ActivityIndicator,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { fetchCourts, type Court } from '@/lib/courts';
import CourtCard from '@/components/CourtCard';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { AppText } from '@/components/ui/AppText';
import { CourtListSkeleton } from '@/components/skeletons/CourtListSkeleton';
import { ErrorScreen } from '@/components/ui/ErrorScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { EmptyCourtIllustration } from '@/components/illustrations';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { trackOnce } from '@/lib/analytics';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { hapticSuccess } from '@/lib/haptics';

type CourtSection = {
  title: string;
  data: Court[];
};

export default function CourtsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useThemeColors();
  const [sections, setSections] = useState<CourtSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 350;

  // Debounce search input
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!searchInput.trim()) {
      setSearchQuery('');
      return;
    }

    setSearching(true);

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(searchInput.trim());
      setSearching(false);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchInput]);

  const loadCourts = useCallback(async (isRefresh = false): Promise<boolean> => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const courts = await fetchCourts(user?.id, searchQuery);

      const hasSearch = searchQuery.trim().length > 0;
      if (hasSearch) {
        setSections(courts.length > 0 ? [{
          title: `Search Results (${courts.length})`,
          data: courts,
        }] : []);
      } else {
        const followedCourts = courts.filter(c => c.isFollowed);
        const otherCourts = courts.filter(c => !c.isFollowed);

        const newSections: CourtSection[] = [];
        if (followedCourts.length > 0) {
          newSections.push({
            title: 'Your Courts',
            data: followedCourts,
          });
        }
        if (otherCourts.length > 0) {
          newSections.push({
            title: followedCourts.length > 0 ? 'All Courts' : 'Courts',
            data: otherCourts,
          });
        }

        setSections(newSections);
      }
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load courts';

      if (errorMessage.includes('permission') || errorMessage.includes('42501')) {
        setError('Unable to load courts. Please sign in and try again.');
      } else {
        setError('Unable to load courts. Please try again.');
      }
      return false;
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
      setSearching(false);
    }
  }, [user?.id, searchQuery]);

  useEffect(() => {
    trackOnce('courts_list_viewed', 'courts-list-session', { view_mode: 'recommended' });
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCourts();
    }, [loadCourts])
  );

  const onRefresh = useCallback(async () => {
    const ok = await loadCourts(true);
    if (ok) hapticSuccess();
  }, [loadCourts]);

  const handleCourtPress = (courtId: string) => {
    router.push(`/courts/${courtId}`);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  if (error) {
    return (
      <ErrorScreen
        message={error}
        onRetry={() => loadCourts()}
        retryLabel="Retry"
      />
    );
  }

  const renderSectionHeader = ({ section }: { section: CourtSection }) => (
    <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
      <AppText variant="bodyBold" color="text">{section.title}</AppText>
    </View>
  );

  const renderItem = ({ item, index, section }: SectionListRenderItemInfo<Court, CourtSection>) => {
    const sectionIndex = sections.indexOf(section);
    const flatIndex =
      sectionIndex <= 0
        ? index
        : sections.slice(0, sectionIndex).reduce((sum, s) => sum + s.data.length, 0) + index;
    return (
      <AnimatedListItem index={flatIndex}>
        <CourtCard court={item} onPress={handleCourtPress} />
      </AnimatedListItem>
    );
  };

  const isLoading = loading || searching;

  return (
    <Screen>
      <View style={[styles.pageBackground, { backgroundColor: colors.bg }]}>
        <Header
          title="Courts"
          subtitle="Find Courts. Check In. Take Over."
          subtitleTagline
          showBack={false}
          rightIcon={
            user
              ? {
                  name: 'plus.circle.fill',
                  onPress: () => router.push('/courts/new'),
                  accessibilityLabel: 'Add new court',
                }
              : undefined
          }
        />

        <View style={[styles.searchContainer, { backgroundColor: colors.bg }]}>
          <View style={[styles.searchInputContainer, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <IconSymbol
              name="magnifyingglass"
              size={18}
              color={colors.textMuted}
              style={styles.searchIcon}
            />
            <RNTextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search courts by name, address, or city..."
              placeholderTextColor={colors.textMuted}
              value={searchInput}
              onChangeText={setSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
            />
            {searchInput.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                style={styles.clearButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityLabel="Clear search"
              >
                <IconSymbol name="xmark.circle.fill" size={18} color={colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          {searching && (
            <View style={styles.searchingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText variant="mutedSmall" color="textMuted">Searching...</AppText>
            </View>
          )}
        </View>

        {loading && !searchQuery ? (
          <CourtListSkeleton />
        ) : sections.length > 0 ? (
          <SectionList
            style={{ backgroundColor: isDark ? colors.bg : undefined }}
            contentContainerStyle={[styles.listContainer, isDark ? { backgroundColor: colors.bg } : undefined]}
            sections={sections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accentPink}
                colors={[colors.accentPink]}
              />
            }
            ListEmptyComponent={
              <EmptyState
                title={searchQuery ? `No courts found for "${searchQuery}"` : 'No courts yet.'}
                subtitle={searchQuery ? 'Try adjusting your search terms' : undefined}
                actionLabel={!searchQuery && user ? 'Add First Court' : undefined}
                onAction={!searchQuery && user ? () => router.push('/courts/new') : undefined}
                illustration={<EmptyCourtIllustration />}
              />
            }
          />
        ) : !isLoading ? (
          <EmptyState
            title={searchQuery ? `No courts found for "${searchQuery}"` : 'No courts yet.'}
            subtitle={searchQuery ? 'Try adjusting your search terms' : undefined}
            actionLabel={!searchQuery && user ? 'Add First Court' : undefined}
            onAction={!searchQuery && user ? () => router.push('/courts/new') : undefined}
            illustration={<EmptyCourtIllustration />}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pageBackground: {
    flex: 1,
  },
  listContainer: {
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  searchContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    paddingVertical: 0,
    height: '100%',
  },
  clearButton: {
    marginLeft: Spacing.xs,
    padding: Spacing.xs,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  searchingText: {
    ...Typography.mutedSmall,
  },
});
