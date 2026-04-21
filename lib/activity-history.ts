import { supabase } from './supabase';
import { logger } from './logger';

export type ActivityType = 'like' | 'comment' | 'repost';

export type ActivityItem = {
  id: string;
  type: ActivityType;
  created_at: string;
  highlight_id: string;
  highlight_caption: string | null;
  highlight_media_url: string | null;
  highlight_thumbnail_url: string | null;
  highlight_media_type: string;
  highlight_creator_id: string;
  highlight_creator_username: string | null;
  comment_text?: string;
};

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function clampLimit(limit?: number): number {
  const n = limit ?? DEFAULT_PAGE_SIZE;
  return Math.min(Math.max(1, n), MAX_PAGE_SIZE);
}

function clampOffset(offset?: number): number {
  return Math.max(0, offset ?? 0);
}

async function fetchCreatorUsernames(userIds: string[]): Promise<Map<string, string | null>> {
  const unique = [...new Set(userIds)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, username, name')
    .in('user_id', unique);
  if (error) {
    if (__DEV__) console.warn('[activity-history] profiles batch', error);
    logger.warn('[activity-history] profiles batch failed', { err: error });
    return new Map();
  }
  const m = new Map<string, string | null>();
  (data || []).forEach((p: { user_id: string; username: string | null; name: string | null }) => {
    m.set(p.user_id, p.username ?? p.name ?? null);
  });
  return m;
}

type HighlightEmbed = {
  id: string;
  caption: string | null;
  media_url: string;
  thumbnail_url: string | null;
  media_type: string;
  user_id: string;
} | null;

function normalizeHighlight(h: HighlightEmbed | HighlightEmbed[]): HighlightEmbed {
  if (!h) return null;
  return Array.isArray(h) ? h[0] ?? null : h;
}

/**
 * Likes this user gave on highlights (newest first).
 */
export async function getUserLikes(
  userId: string,
  limit?: number,
  offset?: number
): Promise<ActivityItem[]> {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const { data, error } = await supabase
    .from('highlight_likes')
    .select(
      `
      created_at,
      highlight_id,
      highlights (
        id,
        caption,
        media_url,
        thumbnail_url,
        media_type,
        user_id
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (error) {
    if (__DEV__) console.warn('[activity-history] getUserLikes', error);
    logger.warn('[activity-history] getUserLikes failed', { err: error });
    throw error;
  }

  const rows = (data || []) as {
    created_at: string;
    highlight_id: string;
    highlights: HighlightEmbed | HighlightEmbed[];
  }[];

  const creatorIds: string[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (h?.user_id) creatorIds.push(h.user_id);
  }
  const creators = await fetchCreatorUsernames(creatorIds);

  const out: ActivityItem[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (!h) continue;
    const created = row.created_at;
    out.push({
      id: `like:${userId}:${h.id}:${created}`,
      type: 'like',
      created_at: created,
      highlight_id: h.id,
      highlight_caption: h.caption,
      highlight_media_url: h.media_url,
      highlight_thumbnail_url: h.thumbnail_url,
      highlight_media_type: h.media_type,
      highlight_creator_id: h.user_id,
      highlight_creator_username: creators.get(h.user_id) ?? null,
    });
  }
  return out;
}

/**
 * Comments this user left on highlights (newest first).
 */
export async function getUserComments(
  userId: string,
  limit?: number,
  offset?: number
): Promise<ActivityItem[]> {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const { data, error } = await supabase
    .from('highlight_comments')
    .select(
      `
      id,
      created_at,
      body,
      highlight_id,
      highlights (
        id,
        caption,
        media_url,
        thumbnail_url,
        media_type,
        user_id
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (error) {
    if (__DEV__) console.warn('[activity-history] getUserComments', error);
    logger.warn('[activity-history] getUserComments failed', { err: error });
    throw error;
  }

  const rows = (data || []) as {
    id: string;
    created_at: string;
    body: string;
    highlight_id: string;
    highlights: HighlightEmbed | HighlightEmbed[];
  }[];

  const creatorIds: string[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (h?.user_id) creatorIds.push(h.user_id);
  }
  const creators = await fetchCreatorUsernames(creatorIds);

  const out: ActivityItem[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (!h) continue;
    out.push({
      id: row.id,
      type: 'comment',
      created_at: row.created_at,
      highlight_id: h.id,
      highlight_caption: h.caption,
      highlight_media_url: h.media_url,
      highlight_thumbnail_url: h.thumbnail_url,
      highlight_media_type: h.media_type,
      highlight_creator_id: h.user_id,
      highlight_creator_username: creators.get(h.user_id) ?? null,
      comment_text: row.body,
    });
  }
  return out;
}

/**
 * Reposts by this user (newest first).
 */
export async function getUserReposts(
  userId: string,
  limit?: number,
  offset?: number
): Promise<ActivityItem[]> {
  const lim = clampLimit(limit);
  const off = clampOffset(offset);
  const { data, error } = await supabase
    .from('highlight_reposts')
    .select(
      `
      id,
      created_at,
      highlight_id,
      highlights (
        id,
        caption,
        media_url,
        thumbnail_url,
        media_type,
        user_id
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .range(off, off + lim - 1);

  if (error) {
    if (__DEV__) console.warn('[activity-history] getUserReposts', error);
    logger.warn('[activity-history] getUserReposts failed', { err: error });
    throw error;
  }

  const rows = (data || []) as {
    id: string;
    created_at: string;
    highlight_id: string;
    highlights: HighlightEmbed | HighlightEmbed[];
  }[];

  const creatorIds: string[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (h?.user_id) creatorIds.push(h.user_id);
  }
  const creators = await fetchCreatorUsernames(creatorIds);

  const out: ActivityItem[] = [];
  for (const row of rows) {
    const h = normalizeHighlight(row.highlights);
    if (!h) continue;
    out.push({
      id: row.id,
      type: 'repost',
      created_at: row.created_at,
      highlight_id: h.id,
      highlight_caption: h.caption,
      highlight_media_url: h.media_url,
      highlight_thumbnail_url: h.thumbnail_url,
      highlight_media_type: h.media_type,
      highlight_creator_id: h.user_id,
      highlight_creator_username: creators.get(h.user_id) ?? null,
    });
  }
  return out;
}
