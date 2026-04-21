import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, useWindowDimensions } from 'react-native';
import { supabase } from '@/lib/supabase';
import {
  fetchOrderedAttributesForSport,
  fetchSelfRatingsMap,
  type SelfRatingsAttribute,
  type SelfRatingsRow,
  type SelfRatingsSport,
} from '@/lib/self-ratings-queries';
import { playInitialBuzz, playAscendingBuzz, playDescendingBuzz, playSubmitBuzz } from '@/lib/haptics';

export type UseSelfRatingsForSportOptions = {
  /**
   * First-time onboarding: all attributes editable; ±1 change rule skipped for updates.
   * (New ratings are still inserts when none existed.)
   */
  onboardingMode?: boolean;
};

export function useSelfRatingsForSport(
  userId: string | null | undefined,
  selectedSport: SelfRatingsSport | null,
  options?: UseSelfRatingsForSportOptions
) {
  const onboardingMode = options?.onboardingMode ?? false;
  const { width: screenWidth } = useWindowDimensions();

  const [attributes, setAttributes] = useState<SelfRatingsAttribute[]>([]);
  const [ratings, setRatings] = useState<Record<string, SelfRatingsRow>>({});
  const [draftRatings, setDraftRatings] = useState<Record<string, number | null>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const ratingButtonSize = useMemo(() => {
    const NUM_BUTTONS = 10;
    const NUM_GAPS = 9;
    const TOTAL_PADDING = 64;
    const MIN_BUTTON_SIZE = 28;
    const MAX_BUTTON_SIZE = 44;
    const availableWidth = screenWidth - TOTAL_PADDING;
    const gapSize = screenWidth < 400 ? 4 : screenWidth < 500 ? 6 : 8;
    const calculatedSize = Math.floor((availableWidth - NUM_GAPS * gapSize) / NUM_BUTTONS);
    return Math.max(MIN_BUTTON_SIZE, Math.min(MAX_BUTTON_SIZE, calculatedSize));
  }, [screenWidth]);

  const ratingButtonFontSize = useMemo(() => {
    if (ratingButtonSize <= 30) return 12;
    if (ratingButtonSize <= 36) return 14;
    return 16;
  }, [ratingButtonSize]);

  const ratingButtonGap = useMemo(() => (screenWidth < 400 ? 4 : screenWidth < 500 ? 6 : 8), [screenWidth]);

  useEffect(() => {
    if (!userId || !selectedSport) {
      setAttributes([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [attrs, map] = await Promise.all([
        fetchOrderedAttributesForSport(selectedSport.id, selectedSport.name),
        fetchSelfRatingsMap(userId),
      ]);
      if (cancelled) return;
      setAttributes(attrs);
      setRatings(map);
      const draftMap: Record<string, number | null> = {};
      attrs.forEach((a) => {
        const row = map[a.id];
        draftMap[a.id] = row?.rating ?? null;
      });
      setDraftRatings(draftMap);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, selectedSport]);

  const isAttributeEditable = useCallback(
    (attributeId: string): boolean => {
      if (onboardingMode) return true;
      const existingRating = ratings[attributeId];
      if (!existingRating) return true;
      const daysSinceUpdate =
        (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceUpdate >= 30;
    },
    [onboardingMode, ratings]
  );

  const getUnlockDate = useCallback(
    (attributeId: string): Date | null => {
      if (onboardingMode) return null;
      const existingRating = ratings[attributeId];
      if (!existingRating) return null;
      const daysSinceUpdate =
        (Date.now() - new Date(existingRating.last_updated).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate >= 30) return null;
      const unlockDate = new Date(existingRating.last_updated);
      unlockDate.setDate(unlockDate.getDate() + 30);
      return unlockDate;
    },
    [onboardingMode, ratings]
  );

  const attributeEditabilityMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    attributes.forEach((attr) => {
      map[attr.id] = isAttributeEditable(attr.id);
    });
    return map;
  }, [attributes, isAttributeEditable]);

  const attributeUnlockDateMap = useMemo(() => {
    const map: Record<string, Date | null> = {};
    attributes.forEach((attr) => {
      map[attr.id] = getUnlockDate(attr.id);
    });
    return map;
  }, [attributes, getUnlockDate]);

  const handleRating = useCallback(
    async (attributeId: string, newRating: number) => {
      if (!userId || !selectedSport) return;

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
        if (newRating > previousDraft) await playAscendingBuzz();
        else if (newRating < previousDraft) await playDescendingBuzz();
      }

      setDraftRatings((prev) => ({
        ...prev,
        [attributeId]: newRating,
      }));
    },
    [userId, selectedSport, draftRatings, isAttributeEditable, getUnlockDate]
  );

  const hasUnsavedChanges = useCallback((): boolean => {
    return attributes.some((attr) => {
      if (!isAttributeEditable(attr.id)) return false;
      const draftRating = draftRatings[attr.id];
      const existingRating = ratings[attr.id];
      return (
        draftRating !== null &&
        draftRating !== undefined &&
        existingRating?.rating !== draftRating
      );
    });
  }, [attributes, draftRatings, ratings, isAttributeEditable]);

  const saveDraftRatings = useCallback(async (): Promise<{ ok: true; count: number } | { ok: false }> => {
    if (!userId || !selectedSport) return { ok: false };

    const toInsert: { profile_id: string; attribute_id: string; rating: number }[] = [];
    const toUpdate: { attribute_id: string; rating: number }[] = [];

    for (const attr of attributes) {
      if (!isAttributeEditable(attr.id)) continue;

      const draftRating = draftRatings[attr.id];
      if (draftRating === null || draftRating === undefined) continue;

      const existingRating = ratings[attr.id];
      const isNew = !existingRating;

      if (!onboardingMode && !isNew) {
        const currentRating = existingRating.rating;
        if (Math.abs(draftRating - currentRating) > 1) {
          Alert.alert(
            'Change Too Large',
            `You can only adjust "${attr.name}" by 1 point at a time. This helps track gradual progress.`
          );
          return { ok: false };
        }
      }

      if (existingRating && existingRating.rating === draftRating) continue;

      if (isNew) {
        toInsert.push({
          profile_id: userId,
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
      return { ok: true, count: 0 };
    }

    setSaving(true);
    try {
      if (toInsert.length > 0) {
        const { error: insertError } = await supabase.from('self_ratings').insert(toInsert);
        if (insertError) throw insertError;
      }

      for (const update of toUpdate) {
        const { error: updateError } = await supabase
          .from('self_ratings')
          .update({ rating: update.rating })
          .eq('profile_id', userId)
          .eq('attribute_id', update.attribute_id);
        if (updateError) throw updateError;
      }

      await playSubmitBuzz();

      const map = await fetchSelfRatingsMap(userId);
      setRatings(map);
      setDraftRatings(
        Object.fromEntries(attributes.map((a) => [a.id, map[a.id]?.rating ?? null])) as Record<
          string,
          number | null
        >
      );

      return { ok: true, count: toInsert.length + toUpdate.length };
    } catch (error) {
      if (__DEV__) console.warn('[useSelfRatingsForSport:save]', error);
      Alert.alert('Error', 'Unable to save your ratings. Please try again.');
      return { ok: false };
    } finally {
      setSaving(false);
    }
  }, [
    userId,
    selectedSport,
    attributes,
    draftRatings,
    ratings,
    isAttributeEditable,
    onboardingMode,
  ]);

  return {
    attributes,
    ratings,
    draftRatings,
    loading,
    saving,
    ratingButtonSize,
    ratingButtonFontSize,
    ratingButtonGap,
    attributeEditabilityMap,
    attributeUnlockDateMap,
    handleRating,
    hasUnsavedChanges,
    saveDraftRatings,
  };
}
