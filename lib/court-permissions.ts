import { supabase } from '@/lib/supabase';
import type { Court } from '@/lib/courts-api';

/** Loads staff flag for the signed-in user (RLS: profiles readable as per project DB). */
export async function fetchIsStaff(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_staff')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return false;
  return data.is_staff === true;
}

export function isCourtCreatedByUser(court: Court | null, userId: string | undefined): boolean {
  if (!court || !userId || !court.created_by) return false;
  return court.created_by === userId;
}

/** Creator or staff may use direct court edit entry points (backend RLS must also allow). */
export async function getCanDirectEditCourt(
  userId: string | undefined,
  court: Court | null
): Promise<boolean> {
  if (!userId || !court) return false;
  if (isCourtCreatedByUser(court, userId)) return true;
  return fetchIsStaff(userId);
}
