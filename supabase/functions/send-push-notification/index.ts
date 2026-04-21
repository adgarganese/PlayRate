import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

type PushBody = {
  user_id?: string;
  title?: string;
  body?: string;
  data?: Record<string, unknown>;
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isAuthorized(req: Request): boolean {
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) return false;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const shared = Deno.env.get('PUSH_NOTIFY_SHARED_SECRET') ?? '';
  if (serviceKey && token === serviceKey) return true;
  if (shared && token === shared) return true;
  return false;
}

type NotificationPrefsRow = {
  run_reminder_2h: boolean;
  run_reminder_30m: boolean;
  court_new_runs: boolean;
  friends_checkin: boolean;
  dm_notifications: boolean;
  follow_notifications: boolean;
  cosign_notifications: boolean;
};

/** Respects per-type prefs; missing prefs row or unknown type → allow (beta: avoid silent drops). */
function prefsAllowPush(prefs: NotificationPrefsRow | null, notificationType: string): boolean {
  if (!prefs) return true;
  switch (notificationType) {
    case 'new_message':
    case 'dm':
      return prefs.dm_notifications === true;
    case 'new_follower':
    case 'new_follow':
    case 'follow':
      return prefs.follow_notifications === true;
    case 'cosign':
    case 'cosign_given':
    case 'cosign_received':
      return prefs.cosign_notifications === true;
    case 'run_reminder_2h':
      return prefs.run_reminder_2h === true;
    case 'run_reminder_30m':
      return prefs.run_reminder_30m === true;
    case 'court_new_run':
    case 'court_new_runs':
    case 'run_join':
      return prefs.court_new_runs === true;
    case 'friend_checkin':
    case 'friends_checkin':
      return prefs.friends_checkin === true;
    default:
      return true;
  }
}

function stringifyData(data: Record<string, unknown> | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [k, v] of Object.entries(data)) {
    if (v === null || v === undefined) continue;
    out[k] = typeof v === 'string' ? v : JSON.stringify(v);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  if (!isAuthorized(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  let payload: PushBody;
  try {
    payload = (await req.json()) as PushBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const userId = payload.user_id?.trim();
  if (!userId) {
    return jsonResponse({ error: 'user_id required' }, 400);
  }

  const title = payload.title ?? 'PlayRate';
  const bodyText = payload.body ?? '';
  const data = stringifyData(payload.data ?? {});

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return jsonResponse({ error: 'Server misconfigured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey);

  const notificationType = data.type ?? '';
  if (!notificationType) {
    return jsonResponse({ ok: true, skipped: 'missing_notification_type' });
  }

  const { data: prefsRow } = await admin
    .from('notification_prefs')
    .select(
      'run_reminder_2h, run_reminder_30m, court_new_runs, friends_checkin, dm_notifications, follow_notifications, cosign_notifications'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (!prefsAllowPush(prefsRow, notificationType)) {
    return jsonResponse({ ok: true, skipped: 'notification_prefs' });
  }

  const { data: tokens, error: tokErr } = await admin
    .from('device_push_tokens')
    .select('id, push_token')
    .eq('user_id', userId);

  if (tokErr) {
    return jsonResponse({ error: tokErr.message }, 500);
  }

  const rows = tokens ?? [];
  if (rows.length === 0) {
    return jsonResponse({ ok: true, sent: 0 });
  }

  const messages = rows.map((row: { push_token: string }) => ({
    to: row.push_token,
    sound: 'default',
    title,
    body: bodyText,
    data,
  }));

  const toDelete: string[] = [];
  const chunkSize = 100;

  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: 'Expo push failed', detail: text }, 502);
    }

    const expoJson = (await res.json()) as {
      data?: { status?: string; id?: string; message?: string; details?: { error?: string } }[];
    };
    const tickets = expoJson.data ?? [];

    tickets.forEach((ticket, idx) => {
      const globalIdx = i + idx;
      const row = rows[globalIdx];
      if (!row) return;
      if (ticket.status === 'error') {
        const errCode = ticket.details?.error ?? ticket.message ?? '';
        if (
          errCode === 'DeviceNotRegistered' ||
          errCode === 'InvalidCredentials' ||
          /not registered|invalid.*token/i.test(String(ticket.message ?? ''))
        ) {
          toDelete.push(row.id);
        }
      }
    });
  }

  if (toDelete.length > 0) {
    await admin.from('device_push_tokens').delete().in('id', toDelete);
  }

  return jsonResponse({ ok: true, sent: messages.length, removed_invalid: toDelete.length });
});
