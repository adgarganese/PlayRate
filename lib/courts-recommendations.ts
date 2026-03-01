import { supabase } from './supabase';

/**
 * Court-based recommendation for the Home "Recommended Runs" list.
 * Same display shape as RunListItem. id is court_id — use for navigation to court detail (/courts/[id]).
 */
export type RecommendedCourtItem = {
  id: string; // court_id
  courtName: string;
  distance: string;
  startTime: string;
  spotsLeft: number;
};

const RECOMMENDED_RUNS_LIMIT = 10;
const ENGAGEMENT_CAP = 200;
const GLOBAL_AVG_RATING = 6; // 1–10 scale
const BAYESIAN_M = 15;
const DISTANCE_DECAY_MILES = 5;

function haversineMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3959; // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetch recommended runs for the Home screen.
 * Scores by: distance (0–40), engagement (0–35), quality with Bayesian shrinkage (0–25).
 * If userLat/userLng are null, distance score is 0 and ordering is by engagement + quality only.
 */
export async function fetchRecommendedRuns(
  userLat: number | null,
  userLng: number | null
): Promise<RecommendedCourtItem[]> {
  const { data: courtsData, error: courtsError } = await supabase
    .from('courts')
    .select('id, name, lat, lng, created_at')
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('created_at', { ascending: false })
    .limit(100);

  if (courtsError || !courtsData?.length) {
    return [];
  }

  const courtIds = courtsData.map((c) => c.id);

  // Batched: rating stats per court (view may not exist; fallback to empty)
  let ratingByCourt: Record<string, { average_rating: number; rating_count: number }> = {};
  try {
    const { data: ratingRows } = await supabase
      .from('court_rating_stats')
      .select('court_id, average_rating, rating_count')
      .in('court_id', courtIds);
    if (ratingRows) {
      ratingRows.forEach((r: { court_id: string; average_rating: number; rating_count: number }) => {
        ratingByCourt[r.court_id] = {
          average_rating: Number(r.average_rating) || 0,
          rating_count: Number(r.rating_count) || 0,
        };
      });
    }
  } catch (error) {
    if (__DEV__) console.warn('[courts-recommendations:fetchRecommendedRuns] court_rating_stats', error);
  }

  // Batched: check-in counts per court
  const checkInCountByCourt: Record<string, number> = {};
  courtIds.forEach((id) => (checkInCountByCourt[id] = 0));
  try {
    const { data: checkInRows } = await supabase
      .from('check_ins')
      .select('court_id')
      .in('court_id', courtIds);
    if (checkInRows) {
      checkInRows.forEach((r: { court_id: string }) => {
        checkInCountByCourt[r.court_id] = (checkInCountByCourt[r.court_id] || 0) + 1;
      });
    }
  } catch (error) {
    if (__DEV__) console.warn('[courts-recommendations:fetchRecommendedRuns] check_ins', error);
  }

  // Batched: comment counts per court
  const commentCountByCourt: Record<string, number> = {};
  courtIds.forEach((id) => (commentCountByCourt[id] = 0));
  try {
    const { data: commentRows } = await supabase
      .from('court_comments')
      .select('court_id')
      .in('court_id', courtIds);
    if (commentRows) {
      commentRows.forEach((r: { court_id: string }) => {
        commentCountByCourt[r.court_id] = (commentCountByCourt[r.court_id] || 0) + 1;
      });
    }
  } catch (error) {
    if (__DEV__) console.warn('[courts-recommendations:fetchRecommendedRuns] court_comments', error);
  }

  const hasLocation = userLat != null && userLng != null && Number.isFinite(userLat) && Number.isFinite(userLng);

  const scored = courtsData.map((court) => {
    const lat = court.lat as number;
    const lng = court.lng as number;
    const distanceMiles = hasLocation ? haversineMiles(userLat!, userLng!, lat, lng) : 0;

    const distanceScore = hasLocation
      ? 40 * Math.exp(-distanceMiles / DISTANCE_DECAY_MILES)
      : 0;

    const ratingsCount = ratingByCourt[court.id]?.rating_count ?? 0;
    const avgRating = ratingByCourt[court.id]?.average_rating ?? 0;
    const votesCount = checkInCountByCourt[court.id] ?? 0;
    const commentsCount = commentCountByCourt[court.id] ?? 0;
    const engagementRaw = ratingsCount + votesCount + commentsCount;
    const engagementScore = Math.min(
      35,
      Math.max(0, 35 * (Math.log(1 + engagementRaw) / Math.log(1 + ENGAGEMENT_CAP)))
    );

    const adjustedRating =
      (avgRating * ratingsCount + GLOBAL_AVG_RATING * BAYESIAN_M) / (ratingsCount + BAYESIAN_M);
    const qualityNorm = Math.max(0, Math.min(1, (adjustedRating - 1) / 9)); // 1–10 scale
    const qualityScore = 25 * qualityNorm;

    const recommended_score = distanceScore + engagementScore + qualityScore;

    return {
      court,
      distanceMiles,
      recommended_score,
      created_at: court.created_at,
    };
  });

  scored.sort((a, b) => {
    if (b.recommended_score !== a.recommended_score) return b.recommended_score - a.recommended_score;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const top = scored.slice(0, RECOMMENDED_RUNS_LIMIT);

  return top.map(({ court, distanceMiles }) => ({
    id: court.id,
    courtName: court.name,
    distance: hasLocation ? `${distanceMiles.toFixed(1)} mi` : '—',
    startTime: '—',
    spotsLeft: 0,
  }));
}
