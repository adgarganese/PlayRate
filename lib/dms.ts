import { supabase } from './supabase';

export type ConversationRow = {
  id: string;
  created_at: string;
  last_message_at: string | null;
};

export type ParticipantRow = {
  conversation_id: string;
  user_id: string;
  last_read_at: string;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

/** Deep link prefix for highlight shares in DMs. Body = HIGHLIGHT_LINK_PREFIX + highlightId */
export const HIGHLIGHT_LINK_PREFIX = 'playrate://highlights/';

/** Deep link prefix for court shares in DMs. Body = COURT_LINK_PREFIX + courtId */
export const COURT_LINK_PREFIX = 'playrate://courts/';

/** Returns highlight ID if body is a highlight share link, else null. */
export function parseHighlightIdFromBody(body: string): string | null {
  const trimmed = body?.trim() || '';
  if (trimmed.startsWith(HIGHLIGHT_LINK_PREFIX)) {
    const id = trimmed.slice(HIGHLIGHT_LINK_PREFIX.length).split(/[\s?#]/)[0];
    return id && id.length > 0 ? id : null;
  }
  return null;
}

/** Returns court ID if body is a court share link, else null. */
export function parseCourtIdFromBody(body: string): string | null {
  const trimmed = body?.trim() || '';
  if (trimmed.startsWith(COURT_LINK_PREFIX)) {
    const id = trimmed.slice(COURT_LINK_PREFIX.length).split(/[\s?#]/)[0];
    return id && id.length > 0 ? id : null;
  }
  return null;
}

export type ConversationWithMeta = {
  id: string;
  last_message_at: string | null;
  /** Fallback for sort when last_message_at is null (e.g. before conversation UPDATE ran) */
  last_message_created_at: string | null;
  last_message_body: string | null;
  other_user_id: string;
  other_user_name: string | null;
  other_user_username: string | null;
  other_user_avatar_url: string | null;
  unread_count: number;
};

/**
 * Get or create a 1:1 conversation between me and other user.
 * Uses Supabase RPC get_or_create_conversation.
 */
export async function getOrCreateConversation(
  meId: string,
  otherUserId: string
): Promise<string> {
  if (__DEV__) {
    if (__DEV__) console.log('[DM] getOrCreateConversation', { meId, otherUserId });
  }
  const { data, error } = await supabase.rpc('get_or_create_conversation', {
    other_user_id: otherUserId,
  });
  if (error) {
    if (__DEV__) console.error('[DM] getOrCreateConversation error', error);
    throw error;
  }
  if (!data) throw new Error('No conversation id returned');
  const conversationId = data as string;
  if (__DEV__) console.log('[DM] getOrCreateConversation ok', { conversationId });
  return conversationId;
}

function isDmsTableMissing(error: { code?: string; message?: string }): boolean {
  return error.code === 'PGRST205' || /conversation_participants|conversations|messages/.test(error.message ?? '');
}

/** Fallback when RLS only allows reading own participant rows: derive "other" user from message senders. */
async function deriveOtherParticipantsFromMessages(
  meId: string,
  convIds: string[]
): Promise<Map<string, string>> {
  const otherByConv = new Map<string, string>();
  const { data: messages } = await supabase
    .from('messages')
    .select('conversation_id, sender_id')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });
  (messages || []).forEach((m) => {
    if (m.sender_id !== meId && !otherByConv.has(m.conversation_id)) {
      otherByConv.set(m.conversation_id, m.sender_id);
    }
  });
  return otherByConv;
}

/**
 * List conversations for the current user, with last message and other participant info.
 * Includes all threads where the user is a participant (whether they sent or received messages).
 * Built from conversation_participants only — no filter by sender; recipient threads are included.
 * Sorted by last_message_at / last message created_at desc.
 * Returns [] if DM tables do not exist yet (migration not run).
 */
export async function listConversations(meId: string): Promise<ConversationWithMeta[]> {
  const { data: myParticipations, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', meId);
  if (partError) {
    if (isDmsTableMissing(partError)) return [];
    throw partError;
  }
  if (!myParticipations?.length) return [];

  const convIds = myParticipations.map((p) => p.conversation_id);
  const lastReadMap = new Map(myParticipations.map((p) => [p.conversation_id, p.last_read_at]));

  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id, last_message_at')
    .in('id', convIds)
    .order('last_message_at', { ascending: false, nullsFirst: false });
  if (convError) throw convError;
  if (!convs?.length) return [];

  const participants = await supabase
    .from('conversation_participants')
    .select('conversation_id, user_id')
    .in('conversation_id', convIds);
  if (participants.error) {
    if (isDmsTableMissing(participants.error)) return [];
    throw participants.error;
  }

  let otherUserIds = (participants.data || [])
    .filter((p) => p.user_id !== meId)
    .map((p) => ({ conversation_id: p.conversation_id, user_id: p.user_id }));

  if (otherUserIds.length === 0) {
    const otherByConvFromMessages = await deriveOtherParticipantsFromMessages(meId, convIds);
    if (otherByConvFromMessages.size === 0) return [];
    otherUserIds = Array.from(otherByConvFromMessages.entries()).map(([conversation_id, user_id]) => ({
      conversation_id,
      user_id,
    }));
  }

  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, avatar_url')
    .in('user_id', otherUserIds.map((o) => o.user_id));
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
  const otherByConv = new Map(otherUserIds.map((o) => [o.conversation_id, o.user_id]));

  const { data: lastMessages } = await supabase
    .from('messages')
    .select('conversation_id, body, created_at')
    .in('conversation_id', convIds)
    .order('created_at', { ascending: false });
  const lastByConv = new Map<string, { body: string; created_at: string }>();
  (lastMessages || []).forEach((m) => {
    if (!lastByConv.has(m.conversation_id))
      lastByConv.set(m.conversation_id, { body: m.body, created_at: m.created_at });
  });

  const unreadRaw = await Promise.all(
    convIds.map(async (cid) => {
      const lastRead = lastReadMap.get(cid) || '1970-01-01';
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', cid)
        .gt('created_at', lastRead)
        .neq('sender_id', meId);
      return { cid, count: count ?? 0 };
    })
  );
  const unreadPerConv = new Map(unreadRaw.map((r) => [r.cid, r.count]));

  const result: ConversationWithMeta[] = convs
    .map((c) => {
      const otherId = otherByConv.get(c.id);
      if (!otherId) return null;
      const profile = profileMap.get(otherId);
      const last = lastByConv.get(c.id);
      const unread = unreadPerConv.get(c.id) ?? 0;
      return {
        id: c.id,
        last_message_at: c.last_message_at,
        last_message_created_at: last?.created_at ?? null,
        last_message_body: last?.body ?? null,
        other_user_id: otherId,
        other_user_name: profile?.name ?? null,
        other_user_username: profile?.username ?? null,
        other_user_avatar_url: profile?.avatar_url ?? null,
        unread_count: unread,
      };
    })
    .filter((x): x is ConversationWithMeta => x !== null)
    .sort((a, b) => {
      const ta = a.last_message_at || a.last_message_created_at || a.id;
      const tb = b.last_message_at || b.last_message_created_at || b.id;
      return tb.localeCompare(ta);
    });

  return result;
}

/**
 * Fetch messages for a conversation, oldest first.
 */
export async function getMessages(conversationId: string): Promise<MessageRow[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('id, conversation_id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []) as MessageRow[];
}

/**
 * Send a message and update conversation last_message_at.
 */
export async function sendMessage(
  conversationId: string,
  senderId: string,
  body: string
): Promise<MessageRow> {
  if (__DEV__) {
    if (__DEV__) console.log('[DM] sendMessage', { conversationId, senderId, bodyLength: body.length });
  }
  const { data: msg, error: msgError } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: senderId, body })
    .select('id, conversation_id, sender_id, body, created_at')
    .single();
  if (msgError) {
    if (__DEV__) console.error('[DM] sendMessage insert error', msgError);
    throw msgError;
  }
  if (__DEV__) console.log('[DM] sendMessage insert ok', { messageId: (msg as MessageRow).id });

  const { error: updateError } = await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
  if (updateError && __DEV__) {
    if (__DEV__) console.warn('[DM] sendMessage conversation last_message_at update failed', updateError);
  }

  return msg as MessageRow;
}

/**
 * Mark a conversation as read for the current user (update last_read_at).
 * No-op if DM tables do not exist yet.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);
  if (error && !isDmsTableMissing(error)) throw error;
}

/**
 * Total unread count across all conversations for the user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const { data: participations, error: partError } = await supabase
    .from('conversation_participants')
    .select('conversation_id, last_read_at')
    .eq('user_id', userId);
  if (partError) {
    if (isDmsTableMissing(partError)) return 0;
    throw partError;
  }
  if (!participations?.length) return 0;

  let total = 0;
  for (const p of participations) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('conversation_id', p.conversation_id)
      .gt('created_at', p.last_read_at)
      .neq('sender_id', userId);
    total += count ?? 0;
  }
  return total;
}

/** User row for "Send via DM" recipient list (recent conversations + following). */
export type MessageableUser = {
  user_id: string;
  name: string | null;
  username: string | null;
  avatar_url: string | null;
};

/**
 * Users the current user can message: recent conversation partners first, then people they follow.
 * Does not include self. Dedupes by user_id.
 */
export async function getMessageableUsers(meId: string): Promise<MessageableUser[]> {
  const seen = new Set<string>([meId]);
  const result: MessageableUser[] = [];

  try {
    const convos = await listConversations(meId);
    for (const c of convos) {
      if (seen.has(c.other_user_id)) continue;
      seen.add(c.other_user_id);
      result.push({
        user_id: c.other_user_id,
        name: c.other_user_name ?? null,
        username: c.other_user_username ?? null,
        avatar_url: c.other_user_avatar_url ?? null,
      });
    }

    const { data: followingRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', meId);
    const followingIds = (followingRows || []).map((r) => r.following_id).filter((id) => !seen.has(id));
    if (followingIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name, username, avatar_url')
        .in('user_id', followingIds);
      for (const p of profiles || []) {
        if (seen.has(p.user_id)) continue;
        seen.add(p.user_id);
        result.push({
          user_id: p.user_id,
          name: p.name ?? null,
          username: p.username ?? null,
          avatar_url: p.avatar_url ?? null,
        });
      }
    }
  } catch (error) {
    if (__DEV__) console.warn('[dms:getRecipientsForSendDM]', error);
  }
  return result;
}
