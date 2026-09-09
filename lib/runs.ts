import { supabase } from './supabase';
import { track } from './analytics';
import { createInAppNotification } from './create-in-app-notification';

/** Run row from DB with court name (runs + courts join) */
export type RunRow = {
  id: string;
  court_id: string | null;
  creator_id: string;
  starts_at: string;
  ends_at: string;
  skill_band: string;
  skill_min: number | null;
  skill_max: number | null;
  capacity: number;
  notes: string | null;
  status: string;
  court_name: string | null;
};

/** Shaped for Next Best Runs card (top 3) */
export type NextBestRun = {
  id: string;
  courtName: string;
  startTimeLabel: string;
  skillBandLabel: string;
  spotsLeft: number | null;
  run: RunRow;
};

/** Display labels. `balanced` is legacy DB only — never insert it from new JS. */
export const RUN_INTENSITY_LABELS: Record<string, string> = {
  shootaround: 'Shootaround',
  casual: 'Casual',
  balanced: 'Casual',
  competitive: 'Competitive',
  elite: 'Elite',
};

export const RUN_INTENSITY_OPTIONS = [
  'shootaround',
  'casual',
  'competitive',
  'elite',
] as const;

export type RunIntensity = (typeof RUN_INTENSITY_OPTIONS)[number];

const INTENSITY_SKILL_RANGE: Record<RunIntensity, { min: number; max: number }> = {
  shootaround: { min: 1, max: 4 },
  casual: { min: 2, max: 6 },
  competitive: { min: 5, max: 8 },
  elite: { min: 7, max: 10 },
};

export function formatRunIntensityLabel(skillBand: string | null | undefined): string {
  if (!skillBand) return RUN_INTENSITY_LABELS.casual;
  return RUN_INTENSITY_LABELS[skillBand] ?? skillBand;
}

/**
 * Format run start time for display: "Tonight 7:00 PM", "Tomorrow 9:00 AM", "Wed 3:00 PM"
 */
export function formatRunTimeLabel(startsAt: string): string {
  const d = new Date(startsAt);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const runDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.round((runDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));

  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (diffDays === 0) return `Today ${timeStr}`;
  if (diffDays === 1) return `Tomorrow ${timeStr}`;
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${dayNames[d.getDay()]} ${timeStr}`;
}

/**
 * Fetch runs starting in the next 24 hours, status = scheduled, order by starts_at asc, limit 20.
 * Returns runs with court name and participant counts for scoring.
 */
export async function fetchUpcomingRuns(): Promise<{
  runs: RunRow[];
  participantCountByRunId: Record<string, number>;
  followedCourtIds: Set<string>;
  userSkillAvg: number | null;
}> {
  const now = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const { data: runsData, error: runsError } = await supabase
    .from('runs')
    .select(
      `
      id,
      court_id,
      creator_id,
      starts_at,
      ends_at,
      skill_band,
      skill_min,
      skill_max,
      capacity,
      notes,
      status,
      courts(name)
    `
    )
    .eq('status', 'scheduled')
    .gte('starts_at', now.toISOString())
    .lte('starts_at', in24h.toISOString())
    .order('starts_at', { ascending: true })
    .limit(20);

  if (runsError || !runsData?.length) {
    return {
      runs: [],
      participantCountByRunId: {},
      followedCourtIds: new Set(),
      userSkillAvg: null,
    };
  }

  const runs: RunRow[] = runsData.map((r: any) => ({
    id: r.id,
    court_id: r.court_id ?? null,
    creator_id: r.creator_id,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    skill_band: r.skill_band ?? 'casual',
    skill_min: r.skill_min ?? null,
    skill_max: r.skill_max ?? null,
    capacity: r.capacity ?? 10,
    notes: r.notes ?? null,
    status: r.status,
    court_name: r.courts?.name ?? null,
  }));

  const runIds = runs.map((x) => x.id);

  // Participant counts: one query for all runs
  const { data: participantsData } = await supabase
    .from('run_participants')
    .select('run_id')
    .in('run_id', runIds)
    .eq('join_status', 'joined');

  const participantCountByRunId: Record<string, number> = {};
  runIds.forEach((id) => (participantCountByRunId[id] = 0));
  if (participantsData) {
    participantsData.forEach((p: { run_id: string }) => {
      participantCountByRunId[p.run_id] = (participantCountByRunId[p.run_id] ?? 0) + 1;
    });
  }

  const { data } = await supabase.auth.getSession();
  const userId = data?.session?.user?.id ?? null;

  let followedCourtIds = new Set<string>();
  let userSkillAvg: number | null = null;

  if (userId) {
    const [followedRes, ratingsRes] = await Promise.all([
      supabase.from('court_follows').select('court_id').eq('user_id', userId),
      supabase.from('self_ratings').select('rating').eq('profile_id', userId),
    ]);

    if (followedRes.data) {
      followedCourtIds = new Set(followedRes.data.map((f: { court_id: string }) => f.court_id));
    }
    if (ratingsRes.data && ratingsRes.data.length > 0) {
      const sum = (ratingsRes.data as { rating: number }[]).reduce((a, b) => a + b.rating, 0);
      userSkillAvg = sum / ratingsRes.data.length;
    }
  }

  return {
    runs,
    participantCountByRunId,
    followedCourtIds,
    userSkillAvg,
  };
}

/**
 * Score runs locally and return top N (default 3).
 * + Prefer runs within user skill range (if user has self-rating).
 * + Prefer runs at courts the user follows.
 * + Prefer runs with more participants (social proof), not over-weighted.
 */
export function scoreAndPickTopRuns(
  runs: RunRow[],
  participantCountByRunId: Record<string, number>,
  followedCourtIds: Set<string>,
  userSkillAvg: number | null,
  topN: number = 3
): NextBestRun[] {
  const scored = runs.map((run) => {
    let score = 0;

    // Nearest time: higher score for sooner starts (0–30 pts, decay)
    const startsAt = new Date(run.starts_at).getTime();
    const now = Date.now();
    const hoursFromNow = (startsAt - now) / (60 * 60 * 1000);
    score += Math.max(0, 30 - hoursFromNow * 2);

    // Court followed: +25
    if (run.court_id && followedCourtIds.has(run.court_id)) {
      score += 25;
    }

    // Skill match: if user has rating and run has range, +20 if in range
    if (userSkillAvg != null && run.skill_min != null && run.skill_max != null) {
      if (userSkillAvg >= run.skill_min && userSkillAvg <= run.skill_max) {
        score += 20;
      }
    }

    // Social proof: more participants, capped (0–15)
    const participants = participantCountByRunId[run.id] ?? 0;
    score += Math.min(15, participants * 2);

    return { run, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, topN);

  return top.map(({ run }) => ({
    id: run.id,
    courtName: run.court_name ?? 'Unknown court',
    startTimeLabel: formatRunTimeLabel(run.starts_at),
    skillBandLabel: formatRunIntensityLabel(run.skill_band),
    spotsLeft:
      run.capacity > 0
        ? Math.max(0, run.capacity - (participantCountByRunId[run.id] ?? 0))
        : null,
    run,
  }));
}

/**
 * Fetch a single run by ID with court name and participant count (for run detail screen).
 */
export async function fetchRunById(runId: string): Promise<{
  run: RunRow | null;
  participantCount: number;
}> {
  const { data: runData, error: runError } = await supabase
    .from('runs')
    .select(
      'id, court_id, creator_id, starts_at, ends_at, skill_band, skill_min, skill_max, capacity, notes, status, courts(name)'
    )
    .eq('id', runId)
    .maybeSingle();

  if (runError || !runData) {
    return { run: null, participantCount: 0 };
  }

  const run: RunRow = {
    id: runData.id,
    court_id: runData.court_id ?? null,
    creator_id: runData.creator_id,
    starts_at: runData.starts_at,
    ends_at: runData.ends_at,
    skill_band: runData.skill_band ?? 'casual',
    skill_min: runData.skill_min ?? null,
    skill_max: runData.skill_max ?? null,
    capacity: runData.capacity ?? 10,
    notes: runData.notes ?? null,
    status: runData.status,
    court_name: (runData as any).courts?.name ?? null,
  };

  const { count } = await supabase
    .from('run_participants')
    .select('*', { count: 'exact', head: true })
    .eq('run_id', runId)
    .eq('join_status', 'joined');

  return { run, participantCount: count ?? 0 };
}

/**
 * Check if the user has joined this run (run_participants, join_status = 'joined').
 */
export async function isUserParticipantInRun(runId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('run_participants')
    .select('run_id')
    .eq('run_id', runId)
    .eq('user_id', userId)
    .eq('join_status', 'joined')
    .maybeSingle();
  return !error && !!data;
}

/**
 * Join the current user to a run. Fires run_joined when successful.
 */
export async function joinRun(runId: string, userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('run_participants')
    .insert({ run_id: runId, user_id: userId, join_status: 'joined' });
  if (error) return { error };
  track('run_joined', { run_id: runId });

  const { data: run } = await supabase
    .from('runs')
    .select('creator_id, court_id')
    .eq('id', runId)
    .maybeSingle();
  const creatorId = run?.creator_id as string | undefined;
  const courtId = run?.court_id as string | undefined;
  if (courtId) {
    await linkTodayCheckInToRun(courtId, runId);
  }
  if (creatorId && creatorId !== userId) {
    const { data: joiner } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('user_id', userId)
      .maybeSingle();
    const label = joiner?.name?.trim() || joiner?.username || 'Someone';
    await createInAppNotification({
      userId: creatorId,
      actorId: userId,
      type: 'run_join',
      entityType: 'run',
      entityId: runId,
      title: `${label} joined your run`,
      body: null,
    });
  }

  return { error: null };
}

/**
 * Creates a run at a court. Creator is auto-joined. Intensity labels:
 * Shootaround, Casual, Competitive, Elite (`balanced` is legacy display-only).
 */
export async function createScheduledRun(opts: {
  courtId: string;
  creatorId: string;
  sport: string;
  startsAt: Date;
  endsAt: Date;
  skillBand?: RunIntensity;
  skillMin?: number | null;
  skillMax?: number | null;
  capacity?: number;
}): Promise<{ runId: string | null; error: Error | null }> {
  const skill_band = opts.skillBand ?? 'casual';
  const range = INTENSITY_SKILL_RANGE[skill_band];
  const { data, error } = await supabase
    .from('runs')
    .insert({
      court_id: opts.courtId,
      creator_id: opts.creatorId,
      starts_at: opts.startsAt.toISOString(),
      ends_at: opts.endsAt.toISOString(),
      skill_band,
      skill_min: opts.skillMin ?? range.min,
      skill_max: opts.skillMax ?? range.max,
      capacity: opts.capacity ?? 10,
      notes: null,
      status: 'scheduled',
    })
    .select('id')
    .single();

  if (error || !data?.id) {
    return {
      runId: null,
      error: error ? new Error(error.message) : new Error('Run insert failed'),
    };
  }
  track('run_created', {
    court_id: opts.courtId,
    sport: opts.sport,
    scheduled_for_utc: opts.startsAt.toISOString(),
  });
  const { error: joinError } = await supabase.from('run_participants').insert({
    run_id: data.id,
    user_id: opts.creatorId,
    join_status: 'joined',
    role: 'organizer',
  });
  if (joinError && __DEV__) {
    console.warn('[runs] auto-join creator', joinError);
  }
  await linkTodayCheckInToRun(opts.courtId, data.id as string);
  return { runId: data.id as string, error: null };
}

/** Removes the current user from a run. Emits `run_left` on success. */
export async function leaveRun(runId: string, userId: string): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('run_participants')
    .delete()
    .eq('run_id', runId)
    .eq('user_id', userId);
  if (error) return { error: new Error(error.message) };
  track('run_left', { run_id: runId });
  return { error: null };
}

export type CourtActiveRun = {
  run: RunRow;
  participantCount: number;
  isLive: boolean;
};

/**
 * Runs at this court that are live or starting within 8 hours.
 * Check-in stays separate: this list is "who's playing."
 */
export async function fetchActiveRunsForCourt(courtId: string): Promise<CourtActiveRun[]> {
  const now = new Date();
  const horizon = new Date(now.getTime() + 8 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('runs')
    .select(
      'id, court_id, creator_id, starts_at, ends_at, skill_band, skill_min, skill_max, capacity, notes, status, courts(name)'
    )
    .eq('court_id', courtId)
    .eq('status', 'scheduled')
    .gt('ends_at', now.toISOString())
    .lt('starts_at', horizon.toISOString())
    .order('starts_at', { ascending: true })
    .limit(8);

  if (error || !data?.length) return [];

  const runs: RunRow[] = data.map((r: {
    id: string;
    court_id: string | null;
    creator_id: string;
    starts_at: string;
    ends_at: string;
    skill_band: string | null;
    skill_min: number | null;
    skill_max: number | null;
    capacity: number | null;
    notes: string | null;
    status: string;
    courts?: { name: string } | null;
  }) => ({
    id: r.id,
    court_id: r.court_id ?? null,
    creator_id: r.creator_id,
    starts_at: r.starts_at,
    ends_at: r.ends_at,
    skill_band: r.skill_band ?? 'casual',
    skill_min: r.skill_min ?? null,
    skill_max: r.skill_max ?? null,
    capacity: r.capacity ?? 10,
    notes: r.notes ?? null,
    status: r.status,
    court_name: r.courts?.name ?? null,
  }));

  const runIds = runs.map((x) => x.id);
  const { data: participantsData } = await supabase
    .from('run_participants')
    .select('run_id')
    .in('run_id', runIds)
    .eq('join_status', 'joined');

  const countById: Record<string, number> = {};
  runIds.forEach((id) => (countById[id] = 0));
  participantsData?.forEach((p: { run_id: string }) => {
    countById[p.run_id] = (countById[p.run_id] ?? 0) + 1;
  });

  const nowMs = now.getTime();
  return runs.map((run) => ({
    run,
    participantCount: countById[run.id] ?? 0,
    isLive: new Date(run.starts_at).getTime() <= nowMs && new Date(run.ends_at).getTime() > nowMs,
  }));
}

/** Attach today's check-in at this court to a run. No-op if not checked in or RPC not applied yet. */
export async function linkTodayCheckInToRun(courtId: string, runId: string): Promise<void> {
  const { error } = await supabase.rpc('link_check_in_run', {
    p_court_id: courtId,
    p_run_id: runId,
  });
  if (error && __DEV__) {
    console.warn('[runs] link_check_in_run', error.message);
  }
}
