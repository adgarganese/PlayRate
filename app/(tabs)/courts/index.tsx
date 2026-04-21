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
  TouchableOpacity,
  TextInput as RNTextInput,
  type SectionListRenderItemInfo,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { fetchCourts, type Court } from '@/lib/courts';
import CourtCard from '@/components/CourtCard';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppText } from '@/components/ui/AppText';
import { CourtListSkeleton } from '@/components/skeletons/CourtListSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { EmptyCourtIllustration } from '@/components/illustrations';
import { useThemeColors } from '@/contexts/theme-context';
import { trackOnce } from '@/lib/analytics';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { AnimatedListItem } from '@/components/ui/AnimatedListItem';
import { hapticSuccess } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

type CourtSection = {
  title: string;
  data: Court[];
};

export default function CourtsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors, isDark } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [sections, setSections] = useState<CourtSection[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SEARCH_DEBOUNCE_MS = 300;

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const trimmed = searchInput.trim();
    if (!trimmed) {
      setSearchQuery('');
      return;
    }

    debounceTimerRef.current = setTimeout(() => {
      setSearchQuery(trimmed);
    }, SEARCH_DEBOUNCE_MS);

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
      logger.error('[courts-list] loadCourts failed', { err, userId: user?.id });
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

  const isLoading = loading;

  return (
    <Screen>
      <View style={[styles.pageBackground, { backgroundColor: colors.bg }]}>
        <Header
          title="Courts"
          subtitle="Find Courts. Check In. Take Over."
          subtitleTagline
          showBack={false}
          rightElement={
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => router.push('/courts/find')}
                accessibilityLabel="Map view"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IconSymbol name="map" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              {user ? (
                <TouchableOpacity
                  style={styles.headerIconButton}
                  onPress={() => router.push('/courts/new')}
                  accessibilityLabel="Add new court"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol name="plus.circle.fill" size={24} color={colors.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />

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
            placeholder="Search courts by name, address, or city..."
            placeholderTextColor={colors.textMuted}
            value={searchInput}
            onChangeText={setSearchInput}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Search courts"
            returnKeyType="search"
          />
        </View>

        {error ? (
          <View style={styles.errorStateWrap}>
            <ErrorState subtitle={error} onRetry={() => void loadCourts()} />
          </View>
        ) : loading && !searchQuery ? (
          <CourtListSkeleton />
        ) : sections.length > 0 ? (
          <SectionList
            style={{ backgroundColor: isDark ? colors.bg : undefined }}
            contentContainerStyle={[
              styles.listContainer,
              isDark ? { backgroundColor: colors.bg } : undefined,
              { paddingBottom: scrollBottomPadding },
            ]}
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
                title={searchQuery ? `No courts found for "${searchQuery}"` : 'No courts found nearby. Add one!'}
                subtitle={searchQuery ? 'Try adjusting your search terms' : 'Help the community map places to play.'}
                actionLabel={!searchQuery && user ? 'Add court' : undefined}
                onAction={!searchQuery && user ? () => router.push('/courts/new') : undefined}
                illustration={<EmptyCourtIllustration />}
              />
            }
          />
        ) : !isLoading ? (
          <EmptyState
            title={searchQuery ? `No courts found for "${searchQuery}"` : 'No courts found nearby. Add one!'}
            subtitle={searchQuery ? 'Try adjusting your search terms' : 'Help the community map places to play.'}
            actionLabel={!searchQuery && user ? 'Add court' : undefined}
            onAction={!searchQuery && user ? () => router.push('/courts/new') : undefined}
            illustration={<EmptyCourtIllustration />}
          />
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -Spacing.sm,
    gap: Spacing.xs,
  },
  headerIconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorStateWrap: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 280,
  },
  pageBackground: {
    flex: 1,
  },
  listContainer: {},
  sectionHeader: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
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
});
