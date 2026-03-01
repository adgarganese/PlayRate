import { useEffect, useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { track, getOnboardingDurationSeconds } from '@/lib/analytics';
import { supabase } from '@/lib/supabase';
import { playInitialBuzz, playAscendingBuzz, playDescendingBuzz, playSubmitBuzz } from '@/lib/haptics';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { SectionTitle } from '@/components/SectionTitle';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { EmptyState } from '@/components/ui/EmptyState';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { getOrderedAttributes, isSportEnabled } from '@/constants/sport-definitions';

type Sport = {
  id: string;
  name: string;
};

type Attribute = {
  id: string;
  sport_id: string;
  name: string;
};

type Rating = {
  attribute_id: string;
  rating: number;
  last_updated: string;
};

export default function SelfRatingsScreen() {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [sports, setSports] = useState<Sport[]>([]);
  const [selectedSport, setSelectedSport] = useState<Sport | null>(null);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [draftRatings, setDraftRatings] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Calculate responsive button size and font size based on screen width
  // Account for: Screen padding (16px each side) + Card padding (16px each side) = 64px total
  const ratingButtonSize = useMemo(() => {
    const NUM_BUTTONS = 10;
    const NUM_GAPS = 9;
    const TOTAL_PADDING = 64; // Screen + Card padding
    const MIN_BUTTON_SIZE = 28;
    const MAX_BUTTON_SIZE = 44;
    
    const availableWidth = screenWidth - TOTAL_PADDING;
    
    // Gap size scales with screen width: smaller on small screens
    const gapSize = screenWidth < 400 ? 4 : screenWidth < 500 ? 6 : 8;
    
    // Calculate button size to fit all buttons
    const calculatedSize = Math.floor((availableWidth - (NUM_GAPS * gapSize)) / NUM_BUTTONS);
    
    // Clamp between min and max
    return Math.max(MIN_BUTTON_SIZE, Math.min(MAX_BUTTON_SIZE, calculatedSize));
  }, [screenWidth]);

  const ratingButtonFontSize = useMemo(() => {
    // Font size scales with button size
    if (ratingButtonSize <= 30) return 12;
    if (ratingButtonSize <= 36) return 14;
    return 16; // Default bodyBold size
  }, [ratingButtonSize]);

  const ratingButtonGap = useMemo(() => {
    return screenWidth < 400 ? 4 : screenWidth < 500 ? 6 : 8;
  }, [screenWidth]);

  useEffect(() => {
    if (!user) {
      const timer = setTimeout(() => {
        router.replace('/sign-in');
      }, 100);
      return () => clearTimeout(timer);
    }
    loadSports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (selectedSport) {
      loadAttributes();
      loadRatings();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSport, user]);

  const loadSports = async () => {
    if (!user) return;

    const { data: profileSportsData, error: profileSportsError } = await supabase
      .from('profile_sports')
      .select(`
        sport_id,
        sport:sports(id, name)
      `)
      .eq('profile_id', user.id);

    if (!profileSportsError && profileSportsData && profileSportsData.length > 0) {
      const formattedSports = profileSportsData
        .map((ps: any) => ({ id: ps.sport.id, name: ps.sport.name }))
        .filter((s: Sport) => isSportEnabled(s.name));
      setSports(formattedSports);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('sports')
      .select('id, name')
      .order('name');

    if (error) {
      Alert.alert('Error', `Failed to load sports: ${error.message}`);
      setLoading(false);
      return;
    }

    setSports((data || []).filter((s) => isSportEnabled(s.name)));
    setLoading(false);
  };

  const loadAttributes = async () => {
    if (!selectedSport) return;

    const { data, error } = await supabase
      .from('sport_attributes')
      .select('id, sport_id, name')
      .eq('sport_id', selectedSport.id);

    if (error) {
      if (__DEV__) console.warn('[self-ratings] load attributes', error);
      Alert.alert('Error', `Failed to load attributes: ${error.message}`);
      setAttributes([]);
      return;
    }

    if (!data || data.length === 0) {
      setAttributes([]);
      return;
    }

    // Order attributes according to sport definition (ensures consistent display order)
    const orderedAttributes = getOrderedAttributes(selectedSport.name, data || []);
    
    // If getOrderedAttributes returns empty (shouldn't happen), use raw data as fallback
    if (orderedAttributes.length === 0 && data.length > 0) {
      if (__DEV__) console.warn(`[self-ratings] getOrderedAttributes empty for ${selectedSport.name}`);
      const fallbackAttributes = data.map(attr => ({
        id: attr.id,
        sport_id: attr.sport_id,
        name: attr.name,
      }));
      setAttributes(fallbackAttributes);
      return;
    }

    const orderedData = orderedAttributes.map(attr => ({
      id: attr.id,
      sport_id: attr.sport_id,
      name: attr.name,
    }));

    // Ensure uniqueness by ID (fallback safety)
    const uniqueAttributes = Array.from(
      new Map(orderedData.map((attr) => [attr.id, attr])).values()
    );

    setAttributes(uniqueAttributes);
  };

  const loadRatings = async () => {
    if (!user || !selectedSport) return;

    const { data, error } = await supabase
      .from('self_ratings')
      .select('attribute_id, rating, last_updated')
      .eq('profile_id', user.id);

    if (error) {
      if (__DEV__) console.warn('[self-ratings] load ratings', error);
      return;
    }

    const ratingsMap: Record<string, Rating> = {};
    data?.forEach((r) => {
      ratingsMap[r.attribute_id] = r;
    });
    setRatings(ratingsMap);
    
    const draftMap: Record<string, number | null> = {};
    data?.forEach((r) => {
      draftMap[r.attribute_id] = r.rating;
    });
    setDraftRatings(draftMap);
  };

  const isAttributeEditable = (attributeId: string): boolean => {
    const existingRating = ratings[attributeId];
    if (!existingRating) return true;
    
    const daysSinceUpdate = (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
    return daysSinceUpdate >= 30;
  };

  const getUnlockDate = (attributeId: string): Date | null => {
    const existingRating = ratings[attributeId];
    if (!existingRating) return null;
    
    const daysSinceUpdate = (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate >= 30) return null;
    
    const unlockDate = new Date(existingRating.last_updated);
    unlockDate.setDate(unlockDate.getDate() + 30);
    return unlockDate;
  };

  const attributeEditabilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    attributes.forEach(attr => {
      const existingRating = ratings[attr.id];
      if (!existingRating) {
        map[attr.id] = true;
      } else {
        const daysSinceUpdate = (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
        map[attr.id] = daysSinceUpdate >= 30;
      }
    });
    return map;
  }, [attributes, ratings]);

  const attributeUnlockDateMap = useMemo(() => {
    const map: Record<string, Date | null> = {};
    attributes.forEach(attr => {
      const existingRating = ratings[attr.id];
      if (!existingRating) {
        map[attr.id] = null;
      } else {
        const daysSinceUpdate = (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate >= 30) {
          map[attr.id] = null;
        } else {
          const unlockDate = new Date(existingRating.last_updated);
          unlockDate.setDate(unlockDate.getDate() + 30);
          map[attr.id] = unlockDate;
        }
      }
    });
    return map;
  }, [attributes, ratings]);

  const handleRating = async (attributeId: string, newRating: number) => {
    if (!user || !selectedSport) return;

    if (!isAttributeEditable(attributeId)) {
      const unlockDate = getUnlockDate(attributeId);
      if (unlockDate) {
        Alert.alert(
          'Rating Locked',
          `You can update this rating again on ${unlockDate.toLocaleDateString()}. This helps track real progress over time.`
        );
      }
      return;
    }

    const previousDraft = draftRatings[attributeId];
    const isNew = previousDraft === null || previousDraft === undefined;

    if (isNew) {
      await playInitialBuzz();
    } else {
      if (newRating > previousDraft) {
        await playAscendingBuzz();
      } else if (newRating < previousDraft) {
        await playDescendingBuzz();
      }
    }

    setDraftRatings((prev) => ({
      ...prev,
      [attributeId]: newRating,
    }));
  };

  const hasUnsavedChanges = (): boolean => {
    return attributes.some((attr) => {
      if (!isAttributeEditable(attr.id)) return false;
      
      const draftRating = draftRatings[attr.id];
      const existingRating = ratings[attr.id];
      
      return draftRating !== null && draftRating !== undefined && 
        (existingRating?.rating !== draftRating);
    });
  };

  const handleSaveAll = async () => {
    if (!user || !selectedSport) return;

    const toInsert: { profile_id: string; attribute_id: string; rating: number }[] = [];
    const toUpdate: { attribute_id: string; rating: number }[] = [];

    for (const attr of attributes) {
      if (!isAttributeEditable(attr.id)) continue;

      const draftRating = draftRatings[attr.id];
      if (draftRating === null || draftRating === undefined) continue;

      const existingRating = ratings[attr.id];
      const isNew = !existingRating;

      if (!isNew) {
        const currentRating = existingRating.rating;
        if (Math.abs(draftRating - currentRating) > 1) {
          Alert.alert(
            'Change Too Large',
            `You can only adjust "${attr.name}" by 1 point at a time. This helps track gradual progress.`
          );
          return;
        }
      }

      if (existingRating && existingRating.rating === draftRating) continue;

      if (isNew) {
        toInsert.push({
          profile_id: user.id,
          attribute_id: attr.id,
          rating: draftRating,
        });
      } else {
        toUpdate.push({
          attribute_id: attr.id,
          rating: draftRating,
        });
      }
    }

    if (toInsert.length === 0 && toUpdate.length === 0) {
      return;
    }

    setSaving(true);

    try {
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase
          .from('self_ratings')
          .insert(toInsert);
        
        if (insertError) {
          throw insertError;
        }
      }

      for (const update of toUpdate) {
        const { error: updateError } = await supabase
          .from('self_ratings')
          .update({
            rating: update.rating,
          })
          .eq('profile_id', user.id)
          .eq('attribute_id', update.attribute_id);
        
        if (updateError) {
          throw updateError;
        }
      }

      await playSubmitBuzz();

      const durationSeconds = getOnboardingDurationSeconds();
      track('onboarding_completed', { duration_seconds: durationSeconds ?? undefined });

      const savedCount = toInsert.length + toUpdate.length;
      Alert.alert('Saved', `Your ${savedCount} rating${savedCount > 1 ? 's have' : ' has'} been saved!`);
      
      await loadRatings();
    } catch (error) {
      if (__DEV__) console.warn('[self-ratings:save]', error);
      Alert.alert('Error', 'Unable to save your ratings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Header
          title="Self Ratings"
          subtitle="Rate yourself on sport-specific attributes (1-10 scale)"
          showBack={false}
        />
        {sports.length === 0 ? (
          <Card>
            <EmptyState
              title="Select the sports you play first, then rate your skills."
              actionLabel="Choose Sports"
              onAction={() => router.push('/my-sports')}
            />
          </Card>
        ) : (
          <>
            <View style={styles.section}>
              <SectionTitle>Select Sport</SectionTitle>
              <View style={styles.sportGrid}>
                {sports.map((sport) => (
                  <Button
                    key={sport.id}
                    title={sport.name}
                    onPress={() => setSelectedSport(sport)}
                    variant={selectedSport?.id === sport.id ? 'primary' : 'secondary'}
                    style={styles.sportButton}
                  />
                ))}
              </View>
            </View>

            {selectedSport && (
              <View style={styles.section}>
                <SectionTitle>
                  {selectedSport.name} Attributes
                </SectionTitle>
                {attributes.length > 0 && (
                  <Card style={styles.infoBanner}>
                    <Text style={[styles.infoBannerText, { color: colors.text }]}>
                      Update each skill once every 30 days. This helps you track real progress over time.
                    </Text>
                  </Card>
                )}
                {attributes.length === 0 ? (
                  <Card>
                    <EmptyState
                      title={`No skills available for ${selectedSport.name} yet.`}
                    />
                  </Card>
                ) : (
                  <>
                    <View style={styles.attributesList}>
                      {attributes.map((attribute) => {
                        const existingRating = ratings[attribute.id];
                        const draftRating = draftRatings[attribute.id];
                        const isEditable = attributeEditabilityMap[attribute.id] ?? true;
                        const unlockDate = attributeUnlockDateMap[attribute.id] ?? null;

                        return (
                          <Card 
                            key={attribute.id} 
                            style={!isEditable ? { ...styles.attributeCard, ...styles.attributeCardLocked } : styles.attributeCard}
                          >
                            <View style={styles.attributeHeader}>
                              <Text style={[styles.attributeName, { color: colors.text }]}>{attribute.name}</Text>
                              {existingRating && (
                                <View style={[styles.ratingBadge, { backgroundColor: colors.primary }]}>
                                  <Text style={[styles.ratingBadgeText, { color: colors.textOnPrimary }]}>
                                    Saved: {existingRating.rating}/10
                                  </Text>
                                </View>
                              )}
                            </View>

                            {!isEditable && unlockDate && (
                              <Text style={[styles.lockInfo, { color: colors.text }]}>
                                Next update available on {unlockDate.toLocaleDateString()}
                              </Text>
                            )}

                            {existingRating && isEditable && (
                              <Text style={[styles.updateInfo, { color: colors.textMuted }]}>
                                Last updated: {new Date(existingRating.last_updated).toLocaleDateString()}
                              </Text>
                            )}

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
                                    onPress={() => handleRating(attribute.id, value)}
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
                    
                    {hasUnsavedChanges() && (
                      <Button
                        title="Save Changes"
                        onPress={handleSaveAll}
                        variant="primary"
                        loading={saving}
                        disabled={saving}
                        style={styles.saveAllButton}
                      />
                    )}
                  </>
                )}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  sportButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 44,
  },
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
