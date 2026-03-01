import { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator, TextInput as RNTextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '../lib/supabase';
import { Screen } from './ui/Screen';
import { Header } from './ui/Header';
import { ListItem } from './ui/ListItem';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { isSportEnabled } from '@/constants/sport-definitions';

type Profile = {
  user_id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  sports: string[];
  play_style: string | null;
};

export default function Profiles() {
  const router = useRouter();
  const { colors } = useThemeColors();
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, name, username, bio, play_style')
        .limit(50);

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      if (!profilesData || profilesData.length === 0) {
        setAllProfiles([]);
        setLoading(false);
        return;
      }

      const profileIds = profilesData.map(p => p.user_id);
      const { data: profileSportsData } = await supabase
        .from('profile_sports')
        .select('profile_id, sport:sports(name)')
        .in('profile_id', profileIds);

      const sportsByProfile: Record<string, string[]> = {};
      profileSportsData?.forEach((ps: any) => {
        if (!sportsByProfile[ps.profile_id]) {
          sportsByProfile[ps.profile_id] = [];
        }
        if (ps.sport?.name) {
          sportsByProfile[ps.profile_id].push(ps.sport.name);
        }
      });

      const profilesWithSports: Profile[] = profilesData.map((profile) => ({
        ...profile,
        sports: sportsByProfile[profile.user_id] || [],
        play_style: profile.play_style ?? null,
      }));

      setAllProfiles(profilesWithSports);
    } catch (err: any) {
      setError(err.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const handleProfilePress = (userId: string) => {
    router.push(`/athletes/${userId}/profile` as any);
  };

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProfiles;
    }

    const query = searchQuery.toLowerCase().trim();
    return allProfiles.filter((profile) => {
      const nameMatch = profile.name?.toLowerCase().includes(query);
      const usernameMatch = profile.username?.toLowerCase().includes(query);
      return nameMatch || usernameMatch;
    });
  }, [allProfiles, searchQuery]);

  if (loading) {
    return (
      <Screen>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading profiles...</Text>
        </View>
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <View style={styles.errorContainer}>
          <Text style={[styles.errorTitle, { color: colors.text }]}>Error</Text>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error}</Text>
        </View>
      </Screen>
    );
  }

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
      <FlatList
        contentContainerStyle={styles.listContainer}
        data={filteredProfiles}
        keyExtractor={(item) => item.user_id}
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
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {searchQuery.trim() ? 'No athletes found' : 'No athletes yet. Be the first to join!'}
            </Text>
          </View>
        }
      />
    </Screen>
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
  emptyContainer: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...Typography.muted,
    textAlign: 'center',
  },
});
