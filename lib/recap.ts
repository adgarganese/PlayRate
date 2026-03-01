import { supabase } from './supabase';

export const COSIGN_ATTRIBUTES = [
  'shooting',
  'handles',
  'finishing',
  'defense',
  'iq',
  'passing',
  'rebounding',
  'hustle',
  'athleticism',
  'leadership',
] as const;

export type CosignAttribute = (typeof COSIGN_ATTRIBUTES)[number];

export const COSIGN_ATTRIBUTE_LABELS: Record<CosignAttribute, string> = {
  shooting: 'Shooting',
  handles: 'Handles',
  finishing: 'Finishing',
  defense: 'Defense',
  iq: 'IQ',
  passing: 'Passing',
  rebounding: 'Rebounding',
  hustle: 'Hustle',
  athleticism: 'Athleticism',
  leadership: 'Leadership',
};

/** Map display name to cosigns.attribute slug (e.g. "Shooting" -> "shooting"). Returns null if not in enum. */
export function attributeNameToSlug(name: string): CosignAttribute | null {
  const normalized = name.trim();
  const entry = (Object.entries(COSIGN_ATTRIBUTE_LABELS) as [CosignAttribute, string][]).find(
    ([, v]) => v === normalized || v.toLowerCase() === normalized.toLowerCase()
  );
  return entry ? entry[0] : null;
}

const REP_LEVEL_THRESHOLDS = [0, 5, 15, 30, 50, 80] as const; // Level 1..6

export type RecapEligibility = {
  eligible: boolean;
  error?: string;
  run?: { id: string; ends_at: string; status: string };
};

/**
 * Check if the user can do recap for this run: authenticated, participant, run ended or completed.
 */
export async function checkRecapEligibility(
  runId: string,
  userId: string
): Promise<RecapEligibility> {
  const { data: runData, error: runError } = await supabase
    .from('runs')
    .select('id, ends_at, status')
    .eq('id', runId)
    .maybeSingle();

  if (runError || !runData) {
    return { eligible: false, error: 'Run not found.' };
  }

  const runEnded = new Date(runData.ends_at) < new Date();
  const runCompleted = runData.status === 'completed';
  if (!runEnded && !runCompleted) {
    return {
      eligible: false,
      error: "This run hasn't ended yet. Recap is available after the run ends.",
      run: runData,
    };
  }

  const { data: participant, error: partError } = await supabase
    .from('run_participants')
    .select('run_id')
    .eq('run_id', runId)
    .eq('user_id', userId)
    .eq('join_status', 'joined')
    .maybeSingle();

  if (partError || !participant) {
    return {
      eligible: false,
      error: "You weren't in this run. Only participants can submit a recap.",
      run: runData,
    };
  }

  return { eligible: true, run: runData };
}

export type RecapParticipant = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/**
 * Fetch participants for this run (joined), excluding the current user. With profile info.
 */
export async function fetchRecapParticipants(
  runId: string,
  excludeUserId: string
): Promise<RecapParticipant[]> {
  const { data: rows, error } = await supabase
    .from('run_participants')
    .select('user_id')
    .eq('run_id', runId)
    .eq('join_status', 'joined')
    .neq('user_id', excludeUserId);

  if (error || !rows?.length) return [];

  const userIds = rows.map((r: { user_id: string }) => r.user_id);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, avatar_url')
    .in('user_id', userIds);

  if (!profiles?.length) return [];

  const byId = new Map(profiles.map((p: RecapParticipant) => [p.user_id, p]));
  return userIds.map((id) => byId.get(id)!).filter(Boolean);
}

export type SubmitCosignResult = { success: true } | { success: false; error: string };

/**
 * Insert one cosign. Handles unique constraint (duplicate) and self-cosign.
 */
export async function submitCosign(
  fromUserId: string,
  toUserId: string,
  runId: string,
  attribute: CosignAttribute,
  note: string | null
): Promise<SubmitCosignResult> {
  if (fromUserId === toUserId) {
    return { success: false, error: "You can't cosign yourself." };
  }

  const trimmedNote = note?.trim() || null;
  if (trimmedNote !== null && trimmedNote.length > 140) {
    return { success: false, error: 'Note must be 140 characters or less.' };
  }

  const { error } = await supabase.from('cosigns').insert({
    from_user_id: fromUserId,
    to_user_id: toUserId,
    run_id: runId,
    attribute,
    note: trimmedNote || undefined,
  });

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: "You've already given this player this attribute for this run." };
    }
    return { success: false, error: error.message || 'Failed to add cosign.' };
  }

  return { success: true };
}

export type RepRollup = {
  total_cosigns: number;
  rep_level: number;
  cosigns_by_attribute: Record<string, number>;
  updated_at: string;
};

/**
 * Fetch rep_rollups for the current user (cosigns received).
 */
export async function fetchRepRollups(userId: string): Promise<RepRollup | null> {
  const { data, error } = await supabase
    .from('rep_rollups')
    .select('total_cosigns, rep_level, cosigns_by_attribute, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return {
    total_cosigns: data.total_cosigns ?? 0,
    rep_level: data.rep_level ?? 1,
    cosigns_by_attribute: (data.cosigns_by_attribute as Record<string, number>) ?? {},
    updated_at: data.updated_at ?? '',
  };
}

/**
 * Given total cosigns, return current level and "X cosigns from Level Y" (next level).
 */
export function getRepProgress(totalCosigns: number): {
  level: number;
  nextLevel: number | null;
  cosignsToNextLevel: number | null;
  label: string;
} {
  let level = 1;
  for (let i = REP_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalCosigns >= REP_LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }

  if (level >= 6) {
    return {
      level: 6,
      nextLevel: null,
      cosignsToNextLevel: null,
      label: "You're at max level.",
    };
  }

  const nextThreshold = REP_LEVEL_THRESHOLDS[level];
  const cosignsToNextLevel = nextThreshold - totalCosigns;

  return {
    level,
    nextLevel: level + 1,
    cosignsToNextLevel,
    label: `You're ${cosignsToNextLevel} cosign${cosignsToNextLevel === 1 ? '' : 's'} from Level ${level + 1}.`,
  };
}
