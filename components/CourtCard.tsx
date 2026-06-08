import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Card } from './Card';
import { AnimatedPressable } from './ui/AnimatedPressable';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import type { Court } from '@/lib/courts';

const IMAGE_TRANSITION_MS = 160;

type CourtCardProps = {
  court: Court;
  onPress: (courtId: string) => void;
};

export default function CourtCard({ court, onPress }: CourtCardProps) {
  const { colors } = useThemeColors();

  return (
    <AnimatedPressable onPress={() => onPress(court.id)}>
      <Card elevated={false} style={styles.courtCard}>
        <Text
          style={[styles.courtName, { color: colors.text }]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {court.name}
        </Text>

        <View style={[styles.photoArea, { backgroundColor: colors.surfaceAlt }]}>
          {court.featured_photo_url ? (
            <Image
              source={{ uri: court.featured_photo_url }}
              style={styles.photo}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={IMAGE_TRANSITION_MS}
              recyclingKey={court.id}
            />
          ) : (
            <View style={styles.photoPlaceholder}>
              <IconSymbol name="sportscourt.fill" size={48} color={colors.textMuted} />
            </View>
          )}
          {court.isFollowed && (
            <View style={[styles.followedBadge, { backgroundColor: colors.primary + '20', borderColor: colors.primary }]}>
              <Text style={[styles.followedBadgeText, { color: colors.text }]}>Following</Text>
            </View>
          )}
        </View>

        <View style={styles.addressBand}>
          {court.address ? (
            <Text
              style={[styles.courtAddress, { color: colors.textMuted }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {court.address}
            </Text>
          ) : null}
        </View>
      </Card>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  courtCard: {
    padding: 0,
    overflow: 'hidden',
  },
  courtName: {
    ...Typography.bodyBold,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  photoArea: {
    aspectRatio: 3 / 4,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followedBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    minHeight: 24,
    minWidth: 70,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  followedBadgeText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  addressBand: {
    minHeight: 32,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    justifyContent: 'center',
  },
  courtAddress: {
    ...Typography.mutedSmall,
  },
});
