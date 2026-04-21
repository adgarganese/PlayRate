import { supabase } from './supabase';
import { logger } from './logger';
import { track } from './analytics';

/** Highlight row as returned from a repost join (author is highlight owner, not reposter). */
export type RepostedHighlight = {
  repost_id: string;
  reposted_at: string;
  highlight: {
    id: string;
    user_id: string;
    sport: string;
    media_type: string;
    media_url: string;
    thumbnail_url: string | null;
    caption: string | null;
    created_at: string;
    is_public: boolean;
  };
};

const PG_UNIQUE_VIOLATION = '23505';

/**
 * Create a repost row. If the user already reposted this highlight, completes successfully (idempotent).
 */
export async function repostHighlight(highlightId: string, userId: string): Promise<void> {
  const { error } = await supabase.from('highlight_reposts').insert({
    highlight_id: highlightId,
    user_id: userId,
  });
  if (!error) {
    const { data: h } = await supabase.from('highlights').select('sport').eq('id', highlightId).maybeSingle();
    const sport =
      h?.sport && String(h.sport).trim() ? String(h.sport).trim() : 'unknown';
    track('highlight_reposted', { highlight_id: highlightId, sport });
    return;
  }
  if (error.code === PG_UNIQUE_VIOLATION) return;
  if (__DEV__) console.warn('[reposts] repostHighlight', error);
  logger.warn('[reposts] repostHighlight failed', { err: error });
  throw error;
}

export async function undoRepost(highlightId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('highlight_reposts')
    .delete()
    .eq('highlight_id', highlightId)
    .eq('user_id', userId);
  if (error) {
    if (__DEV__) console.warn('[reposts] undoRepost', error);
    logger.warn('[reposts] undoRepost failed', { err: error });
    throw error;
  }
}

export async function hasUserReposted(highlightId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('highlight_reposts')
    .select('id')
    .eq('highlight_id', highlightId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    if (__DEV__) console.warn('[reposts] hasUserReposted', error);
    return false;
  }
  return !!data;
}

export async function getRepostsByUser(
  userId: string,
  limit: number = 50
): Promise<RepostedHighlight[]> {
  const cap = Math.min(Math.max(1, limit), 100);
  const { data, error } = await supabase
    .from('highlight_reposts')
    .select(
      `
      id,
      created_at,
      highlight_id,
      highlights (
        id,
        user_id,
        sport,
        media_type,
        media_url,
        thumbnail_url,
        caption,
        created_at,
        is_public
      )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(cap);

  if (error) {
    if (__DEV__) console.warn('[reposts] getRepostsByUser', error);
    logger.warn('[reposts] getRepostsByUser failed', { err: error });
    return [];
  }

  const rows = (data || []) as {
    id: string;
    created_at: string;
    highlight_id: string;
    highlights:
      | {
          id: string;
          user_id: string;
          sport: string;
          media_type: string;
          media_url: string;
          thumbnail_url: string | null;
          caption: string | null;
          created_at: string;
          is_public: boolean;
        }
      | null
      | {
          id: string;
          user_id: string;
          sport: string;
          media_type: string;
          media_url: string;
          thumbnail_url: string | null;
          caption: string | null;
          created_at: string;
          is_public: boolean;
        }[];
  }[];

  const out: RepostedHighlight[] = [];
  for (const row of rows) {
    const h = row.highlights;
    const highlight = Array.isArray(h) ? h[0] : h;
    if (!highlight) continue;
    out.push({
      repost_id: row.id,
      reposted_at: row.created_at,
      highlight,
    });
  }
  return out;
}
