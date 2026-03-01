import { supabase } from './supabase';

/**
 * Get the set of court IDs that a user follows (for use in court list / run scoring).
 */
export async function getFollowedCourtIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('court_follows')
    .select('court_id')
    .eq('user_id', userId);

  if (error) {
    if (__DEV__) console.warn('[court-follows]', error);
    return new Set();
  }
  return new Set((data || []).map((f) => f.court_id));
}

/**
 * Check if user is following a court
 */
export async function checkFollowingCourt(userId: string, courtId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('court_follows')
    .select('court_id')
    .eq('user_id', userId)
    .eq('court_id', courtId)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return !!data;
}
