import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './Card';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';

export type Court = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  created_by: string | null;
  created_at: string;
  sports: string[];
  isFollowed?: boolean;
};

type CourtCardProps = {
  court: Court;
  onPress: (courtId: string) => void;
};

export default function CourtCard({ court, onPress }: CourtCardProps) {
  const { colors } = useThemeColors();

  return (
    <TouchableOpacity
      onPress={() => onPress(court.id)}
      activeOpacity={0.7}
    >
      <Card style={styles.courtCard}>
        <View style={styles.courtCardHeader}>
          <Text style={[styles.courtName, { color: colors.text }]}>{court.name}</Text>
          {court.isFollowed && (
            <View style={[styles.followedBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
              <Text style={[styles.followedBadgeText, { color: colors.text }]}>Following</Text>
            </View>
          )}
        </View>
        {court.address && (
          <Text style={[styles.courtAddress, { color: colors.textMuted }]}>{court.address}</Text>
        )}
        {court.sports.length > 0 ? (
          <View style={styles.sportsContainer}>
            {court.sports.map((sport, index) => (
              <View key={index} style={[styles.sportBadge, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
                <Text style={[styles.sportBadgeText, { color: colors.text }]}>{sport}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.noSportsText, { color: colors.textMuted }]}>No sports listed</Text>
        )}
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  courtCard: {
    marginBottom: Spacing.md,
  },
  courtCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  courtName: {
    ...Typography.bodyBold,
    flex: 1,
  },
  followedBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderWidth: 1,
    marginLeft: Spacing.sm,
  },
  followedBadgeText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  courtAddress: {
    ...Typography.muted,
    marginBottom: Spacing.md,
  },
  sportsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  sportBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.xs,
    borderWidth: 1,
  },
  sportBadgeText: {
    ...Typography.mutedSmall,
  },
  noSportsText: {
    ...Typography.muted,
    fontStyle: 'italic',
  },
});
