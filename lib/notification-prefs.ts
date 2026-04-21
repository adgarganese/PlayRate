import { supabase } from './supabase';

export type NotificationPrefs = {
  run_reminder_2h: boolean;
  run_reminder_30m: boolean;
  court_new_runs: boolean;
  friends_checkin: boolean;
  dm_notifications: boolean;
  follow_notifications: boolean;
  cosign_notifications: boolean;
};

const DEFAULTS: NotificationPrefs = {
  run_reminder_2h: false,
  run_reminder_30m: false,
  court_new_runs: false,
  friends_checkin: false,
  dm_notifications: false,
  follow_notifications: false,
  cosign_notifications: false,
};

/**
 * Get notification_prefs for a user. Returns defaults if no row exists.
 */
export async function getNotificationPrefs(userId: string): Promise<NotificationPrefs> {
  const { data, error } = await supabase
    .from('notification_prefs')
    .select(
      'run_reminder_2h, run_reminder_30m, court_new_runs, friends_checkin, dm_notifications, follow_notifications, cosign_notifications'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return { ...DEFAULTS };
  return {
    run_reminder_2h: data.run_reminder_2h ?? false,
    run_reminder_30m: data.run_reminder_30m ?? false,
    court_new_runs: data.court_new_runs ?? false,
    friends_checkin: data.friends_checkin ?? false,
    dm_notifications: data.dm_notifications ?? false,
    follow_notifications: data.follow_notifications ?? false,
    cosign_notifications: data.cosign_notifications ?? false,
  };
}

/**
 * Update run reminder prefs atomically. Only writes the toggled field(s) + user_id + updated_at
 * so concurrent toggles don't overwrite each other. Works when no row exists (insert with defaults).
 */
export async function updateRunReminderPrefs(
  userId: string,
  updates: { run_reminder_2h?: boolean; run_reminder_30m?: boolean }
): Promise<{ error: string | null }> {
  const payload: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };
  if (updates.run_reminder_2h !== undefined) payload.run_reminder_2h = updates.run_reminder_2h;
  if (updates.run_reminder_30m !== undefined) payload.run_reminder_30m = updates.run_reminder_30m;

  const { error } = await supabase
    .from('notification_prefs')
    .upsert(payload, { onConflict: 'user_id' });

  return { error: error?.message ?? null };
}
