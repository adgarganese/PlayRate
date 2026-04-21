import { supabase } from '@/lib/supabase';
import { getFollowedCourtIds } from '@/lib/court-follows';
import type { Court } from '@/lib/courts-api';
import { logger } from '@/lib/logger';

type RpcRow = {
  id: string;
  name: string;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  distance_meters: number | string | null;
};

type CourtSportRow = { court_id: string; sports: { name: string } | null };

/**
 * Nearby courts via PostGIS `courts_nearby` RPC (lat/lng in WGS84, radius in meters).
 * Enriches with sport names and follow state for the current user.
 */
export type CourtNearby = Court & { distance_meters?: number };

export async function fetchCourtsNearbyRpc(
  lat: number,
  lng: number,
  userId: string | undefined,
  radiusMeters: number = 25_000
): Promise<CourtNearby[]> {
  const { data, error } = await supabase.rpc('courts_nearby', {
    p_lat: lat,
    p_lng: lng,
    p_radius_meters: radiusMeters,
  });

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as RpcRow[];
  if (rows.length === 0) {
    return [];
  }

  let followed = new Set<string>();
  if (userId) {
    followed = await getFollowedCourtIds(userId);
  }

  const courtIds = rows.map((r) => r.id);
  const sportsByCourt: Record<string, string[]> = {};

  const { data: courtSportsData, error: courtSportsError } = await supabase
    .from('court_sports')
    .select('court_id, sport_id, sports!inner(name)')
    .in('court_id', courtIds);

  if (courtSportsError && __DEV__) {
    logger.warn('[courts-nearby-rpc] court sports', { err: courtSportsError });
  }
  if (courtSportsData) {
    (courtSportsData as unknown as CourtSportRow[]).forEach((cs) => {
      if (!sportsByCourt[cs.court_id]) sportsByCourt[cs.court_id] = [];
      if (cs.sports?.name) sportsByCourt[cs.court_id].push(cs.sports.name);
    });
  }

  const now = new Date().toISOString();

  return rows.map((r) => {
    const latN = typeof r.lat === 'string' ? parseFloat(r.lat) : Number(r.lat);
    const lngN = typeof r.lng === 'string' ? parseFloat(r.lng) : Number(r.lng);
    const dmRaw =
      typeof r.distance_meters === 'string' ? parseFloat(r.distance_meters) : Number(r.distance_meters);
    return {
      id: r.id,
      name: r.name,
      address: r.address,
      lat: Number.isFinite(latN) ? latN : null,
      lng: Number.isFinite(lngN) ? lngN : null,
      created_by: null,
      created_at: now,
      sports: sportsByCourt[r.id] ?? [],
      isFollowed: followed.has(r.id),
      distance_meters: Number.isFinite(dmRaw) ? dmRaw : undefined,
    } as CourtNearby;
  });
}
