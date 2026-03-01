import { useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Card } from './Card';
import { AppText } from './ui/AppText';
import { useThemeColors } from '@/contexts/theme-context';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { getTierFromCosigns } from '@/lib/tiers';
import { TierPill } from './TierPill';
import { IconSymbol } from './ui/icon-symbol';
import { Spacing } from '@/constants/theme';

type SnapshotStats = {
  ratingsCount: number;
  cosignCount: number;
  tier: string;
  lastPlayed: string | null;
};

// Possibly unused: not imported in app.
type YourSnapshotCardProps = {
  onPress?: () => void;
};

export function YourSnapshotCard({ onPress }: YourSnapshotCardProps) {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<SnapshotStats | null>(null);
  const [showTierInfo, setShowTierInfo] = useState(false);

  useEffect(() => {
    if (user) {
      loadSnapshot();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadSnapshot = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Fetch profile with cosign_count and tier (if available from trigger)
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('cosign_count, tier, user_id')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        if (__DEV__) console.error('Error loading profile:', profileError);
      }

      // Get cosign count (use from profile if available, otherwise count)
      let cosignCount = 0;
      if (profile?.cosign_count !== undefined && profile?.cosign_count !== null) {
        cosignCount = profile.cosign_count;
      } else {
        // Fallback: count cosigns
        const { count } = await supabase
          .from('cosigns')
          .select('*', { count: 'exact', head: true })
          .eq('to_user_id', user.id);
        cosignCount = count || 0;
      }

      // Get tier (use from profile if available, otherwise calculate)
      const tier = profile?.tier || getTierFromCosigns(cosignCount);

      // Count self ratings
      const { count: ratingsCount } = await supabase
        .from('self_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', user.id);

      // Get last played (most recent self_rating last_updated)
      const { data: lastRating } = await supabase
        .from('self_ratings')
        .select('last_updated')
        .eq('profile_id', user.id)
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      setStats({
        ratingsCount: ratingsCount || 0,
        cosignCount,
        tier,
        lastPlayed: lastRating?.last_updated || null,
      });
    } catch (error) {
      if (__DEV__) console.error('Error loading snapshot:', error);
    } finally {
      setLoading(false);
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

  if (!user) return null;

  const CardContent = (
    <Card style={styles.card}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="body" color="textMuted" style={styles.loadingText}>Loading snapshot...</AppText>
        </View>
      ) : stats ? (
        <>
          <View style={styles.header}>
            <View style={styles.nameRow}>
              <AppText variant="bodyBold" color="text" style={styles.title}>
                Your Snapshot
              </AppText>
              <View style={styles.tierRow}>
                <TierPill tier={stats.tier as any} size="small" />
                <TouchableOpacity
                  style={styles.infoButton}
                  onPress={() => setShowTierInfo(!showTierInfo)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <IconSymbol
                    name="star.fill"
                    size={12}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>
            {showTierInfo && (
              <AppText variant="mutedSmall" color="textMuted" style={styles.tierInfoText}>
                Tier is based on cosigns received.
              </AppText>
            )}
          </View>

          <View style={[styles.statsRow, { borderTopColor: colors.border }]}>
            <AppText variant="muted" color="textMuted" style={styles.statsText}>
              Ratings: {stats.ratingsCount} • Cosigns: {stats.cosignCount} • Last played: {formatLastPlayed(stats.lastPlayed)}
            </AppText>
          </View>
        </>
      ) : (
        <AppText variant="muted" color="textMuted" style={styles.errorText}>Unable to load snapshot</AppText>
      )}
    </Card>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  loadingText: {
    // Color handled by AppText
  },
  header: {
    marginBottom: Spacing.md,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  title: {
    // Typography handled by AppText
  },
  tierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  infoButton: {
    padding: Spacing.xs,
  },
  tierInfoText: {
    marginTop: Spacing.xs,
    fontStyle: 'italic',
  },
  statsRow: {
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  statsText: {
    // Typography handled by AppText
  },
  errorText: {
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
});
