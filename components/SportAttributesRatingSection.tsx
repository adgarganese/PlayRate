import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import type { SelfRatingsAttribute, SelfRatingsRow } from '@/lib/self-ratings-queries';

type SportAttributesRatingSectionProps = {
  sportName: string;
  attributes: SelfRatingsAttribute[];
  ratings: Record<string, SelfRatingsRow>;
  draftRatings: Record<string, number | null>;
  attributeEditabilityMap: Record<string, boolean>;
  attributeUnlockDateMap: Record<string, Date | null>;
  ratingButtonSize: number;
  ratingButtonFontSize: number;
  ratingButtonGap: number;
  saving: boolean;
  onRatingPress: (attributeId: string, value: number) => void;
  hasUnsavedChanges: () => boolean;
  onSavePress: () => void;
  saveButtonTitle?: string;
  /** When false, the save row is hidden (caller provides another primary action, e.g. onboarding Next). */
  showSaveButton?: boolean;
};

export function SportAttributesRatingSection({
  sportName,
  attributes,
  ratings,
  draftRatings,
  attributeEditabilityMap,
  attributeUnlockDateMap,
  ratingButtonSize,
  ratingButtonFontSize,
  ratingButtonGap,
  saving,
  onRatingPress,
  hasUnsavedChanges,
  onSavePress,
  saveButtonTitle = 'Save Changes',
  showSaveButton = true,
}: SportAttributesRatingSectionProps) {
  const { colors } = useThemeColors();

  if (attributes.length === 0) {
    return (
      <Card>
        <EmptyState title={`No skills available for ${sportName} yet.`} />
      </Card>
    );
  }

  return (
    <>
      <Card style={styles.infoBanner}>
        <Text style={[styles.infoBannerText, { color: colors.text }]}>
          Update each skill once every 30 days. This helps you track real progress over time.
        </Text>
      </Card>
      <View style={styles.attributesList}>
        {attributes.map((attribute) => {
          const existingRating = ratings[attribute.id];
          const draftRating = draftRatings[attribute.id];
          const isEditable = attributeEditabilityMap[attribute.id] ?? true;
          const unlockDate = attributeUnlockDateMap[attribute.id] ?? null;

          return (
            <Card
              key={attribute.id}
              style={
                !isEditable
                  ? { ...styles.attributeCard, ...styles.attributeCardLocked }
                  : styles.attributeCard
              }
            >
              <View style={styles.attributeHeader}>
                <Text style={[styles.attributeName, { color: colors.text }]}>{attribute.name}</Text>
                {existingRating ? (
                  <View style={[styles.ratingBadge, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.ratingBadgeText, { color: colors.textOnPrimary }]}>
                      Saved: {existingRating.rating}/10
                    </Text>
                  </View>
                ) : null}
              </View>

              {!isEditable && unlockDate ? (
                <Text style={[styles.lockInfo, { color: colors.text }]}>
                  Next update available on {unlockDate.toLocaleDateString()}
                </Text>
              ) : null}

              {existingRating && isEditable ? (
                <Text style={[styles.updateInfo, { color: colors.textMuted }]}>
                  Last updated: {new Date(existingRating.last_updated).toLocaleDateString()}
                </Text>
              ) : null}

              <View style={[styles.ratingButtons, { gap: ratingButtonGap }]}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => {
                  const selectedValue = draftRating ?? existingRating?.rating ?? null;
                  const isSelected = selectedValue === value;

                  return (
                    <TouchableOpacity
                      key={value}
                      activeOpacity={0.7}
                      style={[
                        styles.ratingButton,
                        {
                          width: ratingButtonSize,
                          height: ratingButtonSize,
                          backgroundColor: isSelected ? colors.primary : 'transparent',
                          borderColor: isSelected ? colors.primary : colors.border,
                        },
                        !isEditable && styles.ratingButtonDisabled,
                      ]}
                      onPress={() => onRatingPress(attribute.id, value)}
                      disabled={saving || !isEditable}
                    >
                      <Text
                        style={[
                          styles.ratingButtonText,
                          {
                            fontSize: ratingButtonFontSize,
                            color: isSelected ? colors.textOnPrimary : colors.text,
                          },
                          !isEditable && styles.ratingButtonTextDisabled,
                        ]}
                      >
                        {value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>
          );
        })}
      </View>

      {showSaveButton && hasUnsavedChanges() ? (
        <Button
          title={saveButtonTitle}
          onPress={onSavePress}
          variant="primary"
          loading={saving}
          disabled={saving}
          style={styles.saveAllButton}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  infoBanner: {
    marginBottom: Spacing.lg,
  },
  infoBannerText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  attributesList: {
    gap: Spacing.lg,
  },
  attributeCard: {
    marginBottom: 0,
  },
  attributeCardLocked: {
    opacity: 0.7,
  },
  attributeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  attributeName: {
    ...Typography.bodyBold,
    flex: 1,
  },
  ratingBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  ratingBadgeText: {
    ...Typography.mutedSmall,
    fontWeight: '600',
  },
  lockInfo: {
    ...Typography.mutedSmall,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  updateInfo: {
    ...Typography.mutedSmall,
    marginBottom: Spacing.sm,
  },
  ratingButtons: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  ratingButton: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 28,
  },
  ratingButtonDisabled: {
    opacity: 0.4,
  },
  ratingButtonText: {
    ...Typography.bodyBold,
  },
  ratingButtonTextDisabled: {
    opacity: 1,
  },
  saveAllButton: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
});
