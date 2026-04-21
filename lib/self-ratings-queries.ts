import { supabase } from '@/lib/supabase';
import { getOrderedAttributes, isSportEnabled } from '@/constants/sport-definitions';
import { logger } from '@/lib/logger';

export type SelfRatingsSport = { id: string; name: string };

export type SelfRatingsAttribute = {
  id: string;
  sport_id: string;
  name: string;
};

export type SelfRatingsRow = {
  attribute_id: string;
  rating: number;
  last_updated: string;
};

/** Sports from `profile_sports` for the user, filtered to enabled sports. */
export async function fetchProfileSportsForRatings(userId: string): Promise<SelfRatingsSport[]> {
  const { data: profileSportsData, error: profileSportsError } = await supabase
    .from('profile_sports')
    .select(`sport_id, sport:sports(id, name)`)
    .eq('profile_id', userId);

  if (profileSportsError || !profileSportsData?.length) {
    return [];
  }
  return profileSportsData
    .map((ps: any) => ({ id: ps.sport.id, name: ps.sport.name }))
    .filter((s: SelfRatingsSport) => isSportEnabled(s.name));
}

export async function fetchAllEnabledSports(): Promise<SelfRatingsSport[]> {
  const { data, error } = await supabase.from('sports').select('id, name').order('name');
  if (error) {
    if (__DEV__) logger.warn('[self-ratings-queries] load sports failed', { err: error });
    return [];
  }
  return (data || []).filter((s) => isSportEnabled(s.name));
}

export async function fetchOrderedAttributesForSport(
  sportId: string,
  sportName: string
): Promise<SelfRatingsAttribute[]> {
  const { data, error } = await supabase
    .from('sport_attributes')
    .select('id, sport_id, name')
    .eq('sport_id', sportId);

  if (error) {
    if (__DEV__) logger.warn('[self-ratings-queries] load attributes failed', { err: error });
    return [];
  }
  if (!data?.length) return [];

  const orderedAttributes = getOrderedAttributes(sportName, data || []);
  if (orderedAttributes.length === 0 && data.length > 0) {
    return data.map((attr) => ({
      id: attr.id,
      sport_id: attr.sport_id,
      name: attr.name,
    }));
  }
  const orderedData = orderedAttributes.map((attr) => ({
    id: attr.id,
    sport_id: attr.sport_id,
    name: attr.name,
  }));
  return Array.from(new Map(orderedData.map((attr) => [attr.id, attr])).values());
}

export async function fetchSelfRatingsMap(userId: string): Promise<Record<string, SelfRatingsRow>> {
  const { data, error } = await supabase
    .from('self_ratings')
    .select('attribute_id, rating, last_updated')
    .eq('profile_id', userId);

  if (error) {
    if (__DEV__) logger.warn('[self-ratings-queries] load ratings', { err: error });
    return {};
  }
  const ratingsMap: Record<string, SelfRatingsRow> = {};
  data?.forEach((r) => {
    ratingsMap[r.attribute_id] = r;
  });
  return ratingsMap;
}
