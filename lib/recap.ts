import { supabase } from './supabase';
import { getCosignProgressToNextTier, normalizeCosignTierName } from './tiers';
import { createInAppNotification } from './create-in-app-notification';

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
  'dribbling',
  'perimeter-defense',
  'playmaking',
  'post-defense',
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
  dribbling: 'Dribbling',
  'perimeter-defense': 'Perimeter Defense',
  playmaking: 'Playmaking',
  'post-defense': 'Post Defense',
};

/** Normalize a display name to slug form (e.g. "Perimeter Defense" -> "perimeter-defense") for matching. */
function nameToSlugForm(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Map display name to cosigns.attribute slug (e.g. "Shooting" -> "shooting"). Returns null if not in enum. */
export function attributeNameToSlug(name: string): CosignAttribute | null {
  const normalized = name.trim();
  // 1) Exact or case-insensitive label match
  const entry = (Object.entries(COSIGN_ATTRIBUTE_LABELS) as [CosignAttribute, string][]).find(
    ([, v]) => v === normalized || v.toLowerCase() === normalized.toLowerCase()
  );
  if (entry) return entry[0];
  // 2) Slug-form match: DB may store slug or name that normalizes to our slug (e.g. "perimeter defense" -> "perimeter-defense")
  const slugForm = nameToSlugForm(normalized);
  const slugMatch = (COSIGN_ATTRIBUTES as readonly string[]).indexOf(slugForm);
  if (slugMatch !== -1) return COSIGN_ATTRIBUTES[slugMatch];
  // 3) Substring fallback for labels
  const lower = normalized.toLowerCase().replace(/[-\\s]+/g, ' ');
  const bySubstring = (Object.entries(COSIGN_ATTRIBUTE_LABELS) as [CosignAttribute, string][]).find(
    ([slug, label]) => lower.includes(label.toLowerCase()) || label.toLowerCase().includes(lower)
  );
  return bySubstring ? bySubstring[0] : null;
}

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
  rep_level: string | null;
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
    .select('user_id, name, username, avatar_url, rep_level')
    .in('user_id', userIds);

  if (!profiles?.length) return [];

  const byId = new Map(
    (profiles as RecapParticipant[]).map((p) => [p.user_id, p])
  );
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

  const { data: actor } = await supabase
    .from('profiles')
    .select('name, username')
    .eq('user_id', fromUserId)
    .maybeSingle();
  const label = actor?.name?.trim() || actor?.username || 'Someone';
  const attrLabel = COSIGN_ATTRIBUTE_LABELS[attribute];
  await createInAppNotification({
    userId: toUserId,
    actorId: fromUserId,
    type: 'cosign',
    entityType: 'run',
    entityId: runId,
    title: `${label} cosigned you (${attrLabel})`,
    body: trimmedNote,
    metadata: { attribute },
  });

  return { success: true };
}

export type RepRollup = {
  total_cosigns: number;
  rep_level: string;
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
    rep_level: normalizeCosignTierName(data.rep_level as string | number | null | undefined),
    cosigns_by_attribute: (data.cosigns_by_attribute as Record<string, number>) ?? {},
    updated_at: data.updated_at ?? '',
  };
}

/**
 * Progress toward the next named tier from a 90-day rolling cosign total.
 */
export function getRepProgress(totalCosigns: number): {
  tierName: string;
  nextTierName: string | null;
  cosignsToNextLevel: number | null;
  label: string;
} {
  const p = getCosignProgressToNextTier(totalCosigns);
  if (!p.next) {
    return {
      tierName: p.current.name,
      nextTierName: null,
      cosignsToNextLevel: null,
      label: "You're at the top tier.",
    };
  }
  const cosignsToNextLevel =
    p.cosignsToNext != null ? Math.max(0, p.cosignsToNext) : null;
  return {
    tierName: p.current.name,
    nextTierName: p.next.name,
    cosignsToNextLevel,
    label:
      p.progressLabel ??
      `${cosignsToNextLevel ?? 0} more cosign${(cosignsToNextLevel ?? 0) === 1 ? '' : 's'} to reach ${p.next.name}.`,
  };
}
