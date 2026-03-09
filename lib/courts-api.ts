import { supabase } from './supabase';
import { getFollowedCourtIds } from './court-follows';
import { logDevError } from './dev-log';

/** UUID format; court_id columns are UUID — non-UUID ids (e.g. "1" from mock runs) skip DB query */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // Detailed information fields
  indoor?: boolean | null;
  hoop_count?: number | null;
  court_type?: string | null; // 'Full', 'Half', 'Both'
  surface_type?: string | null; // 'Hardwood', 'Asphalt', 'Sport court', etc.
  has_lights?: boolean | null;
  cost?: string | null; // 'Free', 'Paid', or specific cost
  hours?: string | null; // Opening hours
  parking_type?: string | null; // 'Street', 'Lot', 'None'
  amenities?: string[] | null; // Array of amenities
  notes?: string | null; // General notes/rules
};

export type CourtComment = {
  id: string;
  message: string;
  created_at: string;
  user_id: string;
  profile: {
    name: string | null;
    username: string | null;
  } | null;
};

/** Row shape from court_sports select with sports!inner(name) */
type CourtSportRow = { court_id: string; sports: { name: string } | null };

/**
 * Fetch all courts with their sports and follow status.
 *
 * Data requirements:
 * - courts.id, name, address, created_at
 * - sports names for each court (via court_sports + sports join)
 * - whether the current user follows each court (via court_follows)
 *
 * Uses separate queries for reliability (complex joins split into two queries).
 *
 * @param userId - Optional user ID to check follow status
 * @param searchQuery - Optional search query to filter by court name or address
 */
export async function fetchCourts(userId?: string, searchQuery?: string) {
  const trimmedSearch = searchQuery?.trim() ?? '';
  const hasSearch = trimmedSearch.length > 0;

  let query = supabase
    .from('courts')
    .select('id, name, address, created_at');

  if (hasSearch) {
    query = query.or(`name.ilike.%${trimmedSearch}%,address.ilike.%${trimmedSearch}%`);
  }
  query = hasSearch
    ? query.order('name', { ascending: true })
    : query.order('created_at', { ascending: false });
  query = query.limit(50);

  const { data: courtsData, error: courtsError } = await query;

  if (courtsError) {
    if (__DEV__) console.error('[fetchCourts] Query error:', courtsError);
    throw courtsError;
  }

  if (!courtsData || courtsData.length === 0) {
    return [];
  }

  // Fetch followed court IDs if user is authenticated
  let followedCourtIds: Set<string> = new Set();
  if (userId) {
    followedCourtIds = await getFollowedCourtIds(userId);
  }

  // Query 3: Fetch court_sports + sports for all courts (two-table join)
  const courtIds = courtsData.map(c => c.id);

  const { data: courtSportsData, error: courtSportsError } = await supabase
    .from('court_sports')
    .select('court_id, sport_id, sports!inner(name)')
    .in('court_id', courtIds);

  if (courtSportsError && __DEV__) {
    console.warn('[fetchCourts] court sports', courtSportsError);
  }

  // Group sports by court_id
  const sportsByCourt: Record<string, string[]> = {};
  if (courtSportsData) {
    (courtSportsData as unknown as CourtSportRow[]).forEach((cs) => {
      if (!sportsByCourt[cs.court_id]) {
        sportsByCourt[cs.court_id] = [];
      }
      if (cs.sports?.name) {
        sportsByCourt[cs.court_id].push(cs.sports.name);
      }
    });
  }

  // Combine courts with their sports and follow status
  return courtsData.map(court => ({
    ...court,
    lat: null,
    lng: null,
    created_by: null,
    sports: sportsByCourt[court.id] || [],
    isFollowed: followedCourtIds.has(court.id),
  })) as Court[];
}

/** Minimal court data for DM preview card */
export type CourtPreview = {
  id: string;
  name: string;
  address: string | null;
};

/** Fetch minimal court data for DM/chat preview. Returns null if not found. */
export async function getCourtPreview(courtId: string): Promise<CourtPreview | null> {
  const { data, error } = await supabase
    .from('courts')
    .select('id, name, address')
    .eq('id', courtId)
    .maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, address: data.address };
}

/**
 * Fetch a single court by ID with its sports and all details
 * Handles backwards compatibility if new columns don't exist yet
 */
export async function fetchCourtById(courtId: string) {
  let { data: courtData, error: courtError } = await supabase
    .from('courts')
    .select('id, name, address, lat, lng, created_by, created_at, indoor, hoop_count, court_type, surface_type, has_lights, cost, hours, parking_type, amenities, notes')
    .eq('id', courtId)
    .maybeSingle();

  if (courtError && (courtError.message?.includes('column') || courtError.message?.includes('42703') || courtError.code === '42703')) {
    if (__DEV__) console.log('New court detail columns not found, falling back to basic columns');

    const basicResult = await supabase
      .from('courts')
      .select('id, name, address, lat, lng, created_by, created_at')
      .eq('id', courtId)
      .maybeSingle();

    const basicData = basicResult.data;
    courtError = basicResult.error;

    if (basicData) {
      courtData = {
        ...basicData,
        indoor: null,
        hoop_count: null,
        court_type: null,
        surface_type: null,
        has_lights: null,
        cost: null,
        hours: null,
        parking_type: null,
        amenities: null,
        notes: null,
      };
    } else {
      courtData = null;
    }
  }

  if (courtError) {
    throw courtError;
  }

  if (!courtData) {
    return null;
  }

  const { data: courtSportsData } = await supabase
    .from('court_sports')
    .select('sports!inner(name)')
    .eq('court_id', courtId);

  const sports = (courtSportsData as { sports: { name: string } | null }[] | null)?.map((cs) => cs.sports?.name).filter(Boolean) ?? [];

  let amenities: string[] | null = null;
  if (courtData.amenities) {
    if (typeof courtData.amenities === 'string') {
      try {
        amenities = JSON.parse(courtData.amenities);
      } catch (error) {
        logDevError('courts-api:fetchCourtById', error);
        amenities = null;
      }
    } else if (Array.isArray(courtData.amenities)) {
      amenities = courtData.amenities;
    }
  }

  if (!amenities || amenities.length === 0) {
    amenities = deriveAmenitiesFromFields(courtData);
  }

  return {
    ...courtData,
    sports,
    amenities,
  } as Court;
}

function deriveAmenitiesFromFields(courtData: any): string[] {
  const derived: string[] = [];

  if (courtData.has_lights === true) {
    derived.push('Lights');
  }

  if (courtData.indoor === true) {
    derived.push('Indoor');
  } else if (courtData.indoor === false) {
    derived.push('Outdoor');
  }

  if (courtData.parking_type) {
    derived.push(`Parking: ${courtData.parking_type}`);
  }

  if (courtData.surface_type) {
    derived.push(`Surface: ${courtData.surface_type}`);
  }

  if (courtData.cost === 'Free') {
    derived.push('Free');
  } else if (courtData.cost && courtData.cost !== 'Free') {
    derived.push('Paid');
  }

  return derived.length > 0 ? derived : [];
}

/**
 * Fetch comments for a court with author information.
 * Possibly unused: not imported anywhere; CourtComments component is also unused.
 */
export async function fetchCourtComments(courtId: string): Promise<CourtComment[]> {
  const { data: commentsData, error: commentsError } = await supabase
    .from('court_comments')
    .select('id, message, created_at, user_id')
    .eq('court_id', courtId)
    .order('created_at', { ascending: false });

  if (commentsError) {
    throw commentsError;
  }

  if (!commentsData || commentsData.length === 0) {
    return [];
  }

  const userIds = [...new Set(commentsData.map(c => c.user_id))];
  const { data: profilesData, error: profilesError } = await supabase
    .from('profiles')
    .select('user_id, name, username')
    .in('user_id', userIds);

  if (profilesError && __DEV__) {
    console.warn('[court-comments] profiles', profilesError);
  }

  const profileMap: Record<string, { name: string | null; username: string | null }> = {};
  if (profilesData) {
    profilesData.forEach(profile => {
      profileMap[profile.user_id] = {
        name: profile.name,
        username: profile.username,
      };
    });
  }

  return commentsData.map(comment => ({
    id: comment.id,
    message: comment.message,
    created_at: comment.created_at,
    user_id: comment.user_id,
    profile: profileMap[comment.user_id] || null,
  }));
}

/**
 * Fetch courts near a specific location within a radius (in kilometers).
 */
export async function fetchCourtsNearLocation(
  centerLat: number,
  centerLng: number,
  radiusKm: number = 10
): Promise<Court[]> {
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(centerLat * Math.PI / 180));

  const minLat = centerLat - latDelta;
  const maxLat = centerLat + latDelta;
  const minLng = centerLng - lngDelta;
  const maxLng = centerLng + lngDelta;

  const { data: courtsData, error: courtsError } = await supabase
    .from('courts')
    .select('id, name, address, lat, lng, created_by, created_at')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .gte('lat', minLat)
    .lte('lat', maxLat)
    .gte('lng', minLng)
    .lte('lng', maxLng)
    .limit(100);

  if (courtsError) {
    if (__DEV__) console.warn('[fetchCourtsNearLocation]', courtsError);
    throw courtsError;
  }

  if (!courtsData || courtsData.length === 0) {
    return [];
  }

  const courtsWithinRadius = courtsData.filter((court) => {
    if (court.lat === null || court.lng === null) return false;

    const R = 6371;
    const dLat = (court.lat - centerLat) * Math.PI / 180;
    const dLng = (court.lng - centerLng) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(centerLat * Math.PI / 180) *
        Math.cos(court.lat * Math.PI / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance <= radiusKm;
  });

  const courtIds = courtsWithinRadius.map(c => c.id);
  let sportsByCourt: Record<string, string[]> = {};

  if (courtIds.length > 0) {
    const { data: courtSportsData, error: courtSportsError } = await supabase
      .from('court_sports')
      .select('court_id, sport_id, sports!inner(name)')
      .in('court_id', courtIds);

    if (courtSportsError && __DEV__) {
      console.warn('[fetchCourtsNearLocation] court sports', courtSportsError);
    }
    if (courtSportsData) {
      (courtSportsData as unknown as CourtSportRow[]).forEach((cs) => {
        if (!sportsByCourt[cs.court_id]) {
          sportsByCourt[cs.court_id] = [];
        }
        if (cs.sports?.name) {
          sportsByCourt[cs.court_id].push(cs.sports.name);
        }
      });
    }
  }

  return courtsWithinRadius.map(court => ({
    ...court,
    lat: court.lat as number,
    lng: court.lng as number,
    sports: sportsByCourt[court.id] || [],
  })) as Court[];
}

export type CheckInResult = {
  success: boolean;
  message: string;
  last_check_in?: string;
  check_in_id?: string;
};

export type LeaderboardEntry = {
  user_id: string;
  total_check_ins: number;
  rank: number;
  last_check_in: string;
  display_name: string | null;
  username: string | null;
};

export async function checkInCourt(courtId: string): Promise<CheckInResult> {
  const { data, error } = await supabase.rpc('check_in', {
    court_id_param: courtId,
  });

  if (error) {
    throw error;
  }

  return data as CheckInResult;
}

export async function getUserCheckIn(courtId: string, userId: string): Promise<string | null> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('check_ins')
    .select('created_at')
    .eq('court_id', courtId)
    .eq('user_id', userId)
    .gte('created_at', todayStart.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (__DEV__) console.warn('[getUserCheckIn]', error);
    return null;
  }

  return data?.created_at || null;
}

export async function getTodayCheckInCount(courtId: string): Promise<number> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from('check_ins')
    .select('*', { count: 'exact', head: true })
    .eq('court_id', courtId)
    .gte('created_at', todayStart.toISOString());

  if (error) {
    if (__DEV__) console.warn('[getTodayCheckInCount]', error);
    return 0;
  }

  return count || 0;
}

export async function getCourtLeaderboard(courtId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc('get_court_leaderboard', {
    court_id_param: courtId,
    limit_count: limit,
  });

  if (error) {
    if (__DEV__) console.warn('[getCourtLeaderboard]', error);
    throw error;
  }

  return (data || []) as LeaderboardEntry[];
}

export type CourtRatingInfo = {
  average_rating: number;
  rating_count: number;
  user_rating: number | null;
};

export async function getCourtRatingInfo(courtId: string, userId?: string): Promise<CourtRatingInfo> {
  if (!UUID_REGEX.test(courtId)) {
    return { average_rating: 0, rating_count: 0, user_rating: null };
  }
  const { data, error } = await supabase.rpc('get_court_rating_info', {
    court_id_param: courtId,
    user_id_param: userId || null,
  });

  if (error) {
    if (__DEV__) console.warn('[getCourtRatingInfo]', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return {
      average_rating: 0,
      rating_count: 0,
      user_rating: null,
    };
  }

  const result = data[0];
  return {
    average_rating: Number(result.average_rating) || 0,
    rating_count: Number(result.rating_count) || 0,
    user_rating: result.user_rating ? Number(result.user_rating) : null,
  };
}

export async function submitCourtRating(
  courtId: string,
  userId: string,
  rating: number
): Promise<void> {
  if (rating < 1 || rating > 10) {
    throw new Error('Rating must be between 1 and 10');
  }

  const { error } = await supabase
    .from('court_ratings')
    .upsert(
      {
        court_id: courtId,
        user_id: userId,
        rating: rating,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'court_id,user_id',
      }
    );

  if (error) {
    if (__DEV__) console.warn('[submitCourtRating]', error);
    throw error;
  }
}

export async function deleteCourtRating(courtId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('court_ratings')
    .delete()
    .eq('court_id', courtId)
    .eq('user_id', userId);

  if (error) {
    if (__DEV__) console.warn('[deleteCourtRating]', error);
    throw error;
  }
}

export type CourtPhoto = {
  id: string;
  court_id: string;
  user_id: string;
  slot: number;
  storage_path: string;
  created_at: string;
  url?: string;
};

/** Slot used as the main court profile image; slots 2–4 are additional photos. */
export const COURT_PHOTO_PRIMARY_SLOT = 1;

/** Returns the primary (main) court photo, or null. Primary = slot 1. */
export function getPrimaryCourtPhoto(photos: CourtPhoto[]): CourtPhoto | null {
  const sorted = [...photos].sort((a, b) => a.slot - b.slot);
  return sorted[0] ?? null;
}

/** Returns additional court photos (all except primary). */
export function getAdditionalCourtPhotos(photos: CourtPhoto[]): CourtPhoto[] {
  return [...photos].sort((a, b) => a.slot - b.slot).filter((p) => p.slot !== COURT_PHOTO_PRIMARY_SLOT);
}

export async function fetchCourtPhotos(courtId: string): Promise<CourtPhoto[]> {
  if (!UUID_REGEX.test(courtId)) {
    return [];
  }
  const { data, error } = await supabase
    .from('court_photos')
    .select('id, court_id, user_id, slot, storage_path, created_at')
    .eq('court_id', courtId)
    .order('slot', { ascending: true });

  if (error) {
    if (__DEV__) console.warn('[fetchCourtPhotos]', error);
    throw error;
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((photo) => ({
    ...photo,
    url: supabase.storage.from('court-photos').getPublicUrl(photo.storage_path).data.publicUrl,
  }));
}

export async function uploadCourtPhoto(
  courtId: string,
  userId: string,
  slot: number,
  imageUri: string
): Promise<CourtPhoto> {
  if (slot < 1 || slot > 4) {
    throw new Error('Slot must be between 1 and 4');
  }

  const response = await fetch(imageUri);
  const blob = await response.blob();

  const fileExt = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const fileName = `${courtId}-${slot}-${Date.now()}.${fileExt}`;
  const storagePath = `${courtId}/${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('court-photos')
    .upload(storagePath, blob, {
      contentType: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      upsert: true,
    });

  if (uploadError) {
    if (__DEV__) console.warn('[uploadCourtPhoto]', uploadError);
    throw uploadError;
  }

  const { data: { publicUrl } } = supabase.storage
    .from('court-photos')
    .getPublicUrl(storagePath);

  const { data: photoData, error: dbError } = await supabase
    .from('court_photos')
    .upsert(
      {
        court_id: courtId,
        user_id: userId,
        slot: slot,
        storage_path: storagePath,
      },
      {
        onConflict: 'court_id,slot',
      }
    )
    .select()
    .single();

  if (dbError) {
    await supabase.storage.from('court-photos').remove([storagePath]);
    if (__DEV__) console.warn('[uploadCourtPhoto] save record', dbError);
    throw dbError;
  }

  return {
    ...photoData,
    url: publicUrl,
  };
}

export async function deleteCourtPhoto(courtId: string, slot: number, userId: string): Promise<void> {
  const { data: photo, error: fetchError } = await supabase
    .from('court_photos')
    .select('storage_path')
    .eq('court_id', courtId)
    .eq('slot', slot)
    .eq('user_id', userId)
    .single();

  if (fetchError) {
    if (__DEV__) console.warn('[deleteCourtPhoto] fetch', fetchError);
    throw fetchError;
  }

  if (!photo) {
    throw new Error('Photo not found');
  }

  const { error: dbError } = await supabase
    .from('court_photos')
    .delete()
    .eq('court_id', courtId)
    .eq('slot', slot)
    .eq('user_id', userId);

  if (dbError) {
    if (__DEV__) console.warn('[deleteCourtPhoto] record', dbError);
    throw dbError;
  }

  const { error: storageError } = await supabase.storage
    .from('court-photos')
    .remove([photo.storage_path]);

  if (storageError) {
    if (__DEV__) console.warn('[deleteCourtPhoto] storage', storageError);
  }
}

export async function getAvailableSlots(courtId: string): Promise<number[]> {
  const { data, error } = await supabase
    .from('court_photos')
    .select('slot')
    .eq('court_id', courtId);

  if (error) {
    if (__DEV__) console.warn('[fetchAvailableSlots]', error);
    throw error;
  }

  const usedSlots = new Set(data?.map((p) => p.slot) || []);
  return [1, 2, 3, 4].filter((slot) => !usedSlots.has(slot));
}
