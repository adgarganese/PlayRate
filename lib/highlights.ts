import { supabase } from './supabase';
import { track } from './analytics';
import { isOffensiveContent, sanitizeText, SANITIZE_LIMITS } from './sanitize';
import { logger } from './logger';
import { escapeIlikePattern } from '@/lib/ilike-escape';
import { createInAppNotification } from './create-in-app-notification';
import { UI_HIGHLIGHTS_LOAD_FAILED } from './user-facing-errors';

// ============================================================================
// TYPES
// ============================================================================

export type FeedType = 'all' | 'popular' | 'friends_local';

export type FeedHighlight = {
  id: string;
  user_id: string;
  sport: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  view_count: number;
  repost_count: number;
  profile_name: string | null;
  profile_username: string | null;
  profile_avatar_url: string | null;
  /** `profiles.rep_level` (90-day tier) */
  profile_rep_level: string | null;
  is_liked: boolean;
  /** Present when the current user has reposted this highlight */
  has_reposted?: boolean;
  /** When this row appears because someone reposted the highlight (merged “all” feed) */
  reposted_by_username?: string | null;
  /** Stable FlatList key when the same highlight id appears more than once */
  feed_item_key: string;
};

export type HighlightComment = {
  id: string;
  highlight_id: string;
  user_id: string;
  body: string;
  created_at: string;
  parent_id: string | null;
  profile_name: string | null;
  profile_username: string | null;
  profile_avatar_url: string | null;
  profile_rep_level: string | null;
  /** For replies: display name of the parent comment author */
  parent_username: string | null;
};

// ============================================================================
// FEED LOADING
// ============================================================================

/**
 * Load highlights feed with pagination.
 * Architecture ready for future feed types:
 * - 'all': Combined feed (current V1)
 * - 'popular': Order by like_count desc (future)
 * - 'friends_local': Filter by followed users + location (future)
 */
export type LoadHighlightsFeedResult = {
  highlights: FeedHighlight[];
  hasMore: boolean;
  error?: string;
};

function hasHighlightFeedFilters(
  opts:
    | {
        captionSearch?: string;
        sport?: string;
        followingIds?: string[];
        userLocation?: { lat: number; lng: number };
      }
    | undefined
): boolean {
  if (!opts) return false;
  return Boolean(opts.captionSearch?.trim()) || Boolean(opts.sport?.trim());
}

async function fetchPublicRepostFeedRows(fetchSize: number): Promise<
  { repost_id: string; reposted_at: string; reposter_id: string; highlightRow: Record<string, unknown> }[]
> {
  const { data, error } = await supabase
    .from('highlight_reposts')
    .select(
      `
      id,
      created_at,
      user_id,
      highlights!inner (
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
    .eq('highlights.is_public', true)
    .order('created_at', { ascending: false })
    .limit(fetchSize);

  if (error) {
    if (__DEV__) console.warn('[highlights] repost feed rows', error);
    return [];
  }

  return (data || [])
    .map((row: any) => {
      const h = row.highlights;
      const highlightRow = Array.isArray(h) ? h[0] : h;
      if (!highlightRow) return null;
      return {
        repost_id: row.id as string,
        reposted_at: row.created_at as string,
        reposter_id: row.user_id as string,
        highlightRow: highlightRow as Record<string, unknown>,
      };
    })
    .filter(Boolean) as {
    repost_id: string;
    reposted_at: string;
    reposter_id: string;
    highlightRow: Record<string, unknown>;
  }[];
}

function mapRowsToFeedHighlights(
  items: any[],
  profileMap: Map<
    string,
    { name?: string | null; username?: string | null; avatar_url?: string | null; rep_level?: string | null }
  >,
  userLikedIds: Set<string>,
  userRepostedIds: Set<string>,
  currentUserId: string | null,
  feedItemKeyFor: (h: any) => string,
  repostedByFor: (h: any) => string | null | undefined
): FeedHighlight[] {
  return items.map((h: any) => {
    const p = profileMap.get(h.user_id);
    const { _feed_item_key: _fik, _reposted_by_username: _rbu, ...row } = h;
    return {
      ...row,
      comment_count: row.comment_count ?? 0,
      view_count: row.view_count ?? 0,
      repost_count: row.repost_count ?? 0,
      profile_name: p?.name || null,
      profile_username: p?.username || null,
      profile_avatar_url: p?.avatar_url || null,
      profile_rep_level: (p as { rep_level?: string | null } | undefined)?.rep_level ?? null,
      is_liked: userLikedIds.has(row.id),
      has_reposted: currentUserId ? userRepostedIds.has(row.id) : undefined,
      reposted_by_username: repostedByFor(h) ?? null,
      feed_item_key: feedItemKeyFor(h),
    };
  });
}

export async function loadHighlightsFeed(
  feedType: FeedType,
  currentUserId: string | null,
  offset: number,
  limit: number,
  options?: {
    followingIds?: string[];
    userLocation?: { lat: number; lng: number };
    /** Server-side caption fragment (trimmed in caller); escaped inside the query builder. */
    captionSearch?: string;
    /** Exact `highlights.sport` value (e.g. display name "Basketball"). */
    sport?: string;
  }
): Promise<LoadHighlightsFeedResult> {
  try {
    const captionFilterRaw = options?.captionSearch?.trim() ?? '';
    const sportFilterRaw = options?.sport?.trim() ?? '';

    const buildQueryBase = (
      includeCommentCount: boolean,
      includeViewCount: boolean,
      includeRepostCount: boolean
    ) => {
      let cols = 'id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at, like_count';
      if (includeCommentCount) cols += ', comment_count';
      if (includeViewCount) cols += ', view_count';
      if (includeRepostCount) cols += ', repost_count';

      let q = supabase
        .from('highlights_with_counts')
        .select(cols)
        .eq('is_public', true);

      if (captionFilterRaw) {
        q = q.ilike('caption', `%${escapeIlikePattern(captionFilterRaw)}%`);
      }
      if (sportFilterRaw) {
        q = q.eq('sport', sportFilterRaw);
      }

      if (feedType === 'popular') {
        q = q.order('like_count', { ascending: false }).order('created_at', { ascending: false });
      } else if (feedType === 'friends_local' && options?.followingIds?.length) {
        q = q.in('user_id', options.followingIds).order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      return q;
    };

    const runQueryWithRetries = async (
      applyPaging: (q: ReturnType<typeof buildQueryBase>) => ReturnType<typeof buildQueryBase>
    ) => {
      let includeComment = true;
      let includeView = true;
      let includeRepost = true;

      const attempt = () => {
        let q = buildQueryBase(includeComment, includeView, includeRepost);
        q = applyPaging(q);
        return q;
      };

      let { data: rows, error } = await attempt();

      if (error?.code === '42703' && error.message?.includes('repost_count')) {
        includeRepost = false;
        ({ data: rows, error } = await attempt());
      }
      if (error?.code === '42703' && error.message?.includes('view_count')) {
        includeView = false;
        ({ data: rows, error } = await attempt());
      }
      if (error?.code === '42703' && error.message?.includes('comment_count')) {
        includeComment = false;
        ({ data: rows, error } = await attempt());
      }

      return { rows, error };
    };

    const useMergedAllFeed = feedType === 'all' && !hasHighlightFeedFilters(options);
    let items: any[] = [];
    let hasMore = false;

    if (useMergedAllFeed) {
      const fetchSize = Math.min(250, offset + limit + 40);
      const [nativeRes, repostPack] = await Promise.all([
        runQueryWithRetries((q) => q.limit(fetchSize)),
        fetchPublicRepostFeedRows(fetchSize),
      ]);
      const nativeRows = nativeRes.rows as any[] | null | undefined;
      const error = nativeRes.error;

      if (__DEV__) {
        logger.info('[HighlightsFeed] merged query', {
          nativeCount: (nativeRows || []).length,
          repostCount: repostPack.length,
          hasError: !!error,
        });
      }

      if (error) {
        if (__DEV__) console.warn('[highlights] load feed', error);
        logger.warn('[highlights] load feed failed', { err: error });
        return { highlights: [], hasMore: false, error: UI_HIGHLIGHTS_LOAD_FAILED };
      }

      const reposterIds = [...new Set(repostPack.map((r) => r.reposter_id))];
      let reposterNameByUserId = new Map<string, string | null>();
      if (reposterIds.length > 0) {
        const { data: rp } = await supabase
          .from('profiles')
          .select('user_id, username, name')
          .in('user_id', reposterIds);
        (rp || []).forEach((p: any) => {
          reposterNameByUserId.set(p.user_id, p.username || p.name || null);
        });
      }

      type Cand = {
        sort_at: string;
        feed_item_key: string;
        reposted_by_username: string | null;
        row: any;
      };

      const cands: Cand[] = [];
      for (const h of nativeRows || []) {
        cands.push({
          sort_at: h.created_at,
          feed_item_key: `h-${h.id}`,
          reposted_by_username: null,
          row: { ...h },
        });
      }
      for (const r of repostPack) {
        const display = reposterNameByUserId.get(r.reposter_id) ?? null;
        cands.push({
          sort_at: r.reposted_at,
          feed_item_key: `r-${r.repost_id}`,
          reposted_by_username: display,
          row: { ...r.highlightRow },
        });
      }

      cands.sort((a, b) => new Date(b.sort_at).getTime() - new Date(a.sort_at).getTime());
      hasMore = cands.length > offset + limit;
      const sliced = cands.slice(offset, offset + limit);

      const idsNeedingCounts = [
        ...new Set(
          sliced.filter((c) => c.reposted_by_username != null).map((c) => c.row.id as string)
        ),
      ];

      let countsById = new Map<
        string,
        { like_count: number; comment_count: number; view_count: number; repost_count: number }
      >();
      if (idsNeedingCounts.length > 0) {
        const { data: countRows } = await supabase
          .from('highlights_with_counts')
          .select('id, like_count, comment_count, view_count, repost_count')
          .in('id', idsNeedingCounts);
        (countRows || []).forEach((cr: any) => {
          countsById.set(cr.id, {
            like_count: cr.like_count ?? 0,
            comment_count: cr.comment_count ?? 0,
            view_count: cr.view_count ?? 0,
            repost_count: cr.repost_count ?? 0,
          });
        });
      }

      items = sliced.map((c) => {
        const co = countsById.get(c.row.id);
        const base = c.row;
        return {
          ...base,
          like_count: base.like_count ?? co?.like_count ?? 0,
          comment_count: base.comment_count ?? co?.comment_count ?? 0,
          view_count: base.view_count ?? co?.view_count ?? 0,
          repost_count: base.repost_count ?? co?.repost_count ?? 0,
          _feed_item_key: c.feed_item_key,
          _reposted_by_username: c.reposted_by_username,
        };
      });
    } else {
      const { rows, error } = await runQueryWithRetries((q) => q.range(offset, offset + limit - 1));

      if (__DEV__) {
        logger.info('[HighlightsFeed] query result', {
          rowCount: (rows || []).length,
          hasError: !!error,
          errorCode: error?.code ?? null,
        });
      }

      if (error) {
        if (__DEV__) console.warn('[highlights] load feed', error);
        logger.warn('[highlights] load feed failed', { err: error });
        return { highlights: [], hasMore: false, error: UI_HIGHLIGHTS_LOAD_FAILED };
      }

      items = rows || [];
      hasMore = items.length === limit;
    }

    if (items.length === 0) {
      return { highlights: [], hasMore: false };
    }

    const userIds = [...new Set(items.map((h: any) => h.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, username, avatar_url, rep_level')
      .in('user_id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    let userLikedIds = new Set<string>();
    if (currentUserId) {
      const { data: likes } = await supabase
        .from('highlight_likes')
        .select('highlight_id')
        .eq('user_id', currentUserId)
        .in('highlight_id', items.map((h: any) => h.id));
      (likes || []).forEach((l: any) => userLikedIds.add(l.highlight_id));
    }

    let userRepostedIds = new Set<string>();
    if (currentUserId) {
      const { data: repostRows, error: repostErr } = await supabase
        .from('highlight_reposts')
        .select('highlight_id')
        .eq('user_id', currentUserId)
        .in('highlight_id', items.map((h: any) => h.id));
      if (!repostErr && repostRows) {
        (repostRows as { highlight_id: string }[]).forEach((r) => userRepostedIds.add(r.highlight_id));
      }
    }

    const feedItems: FeedHighlight[] = mapRowsToFeedHighlights(
      items,
      profileMap,
      userLikedIds,
      userRepostedIds,
      currentUserId,
      (h: any) => (h._feed_item_key as string | undefined) ?? String(h.id),
      (h: any) => h._reposted_by_username as string | null | undefined
    );

    return { highlights: feedItems, hasMore };
  } catch (err) {
    if (__DEV__) console.warn('[highlights] load feed', err);
    logger.error('[highlights] load feed threw', { err });
    return { highlights: [], hasMore: false, error: UI_HIGHLIGHTS_LOAD_FAILED };
  }
}

// ============================================================================
// LIKES
// ============================================================================

export async function toggleHighlightLike(
  highlightId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<{ success: boolean; newLikedState: boolean }> {
  try {
    if (currentlyLiked) {
      const { error } = await supabase
        .from('highlight_likes')
        .delete()
        .eq('highlight_id', highlightId)
        .eq('user_id', userId);
      if (error) throw error;
      return { success: true, newLikedState: false };
    } else {
      const { error } = await supabase
        .from('highlight_likes')
        .insert({ highlight_id: highlightId, user_id: userId });
      if (error) throw error;

      const { data: highlightRow } = await supabase
        .from('highlights')
        .select('user_id, sport')
        .eq('id', highlightId)
        .maybeSingle();
      const ownerId = highlightRow?.user_id;
      const sportLabel =
        highlightRow?.sport && String(highlightRow.sport).trim()
          ? String(highlightRow.sport).trim()
          : 'unknown';
      track('highlight_liked', { highlight_id: highlightId, sport: sportLabel });
      if (ownerId && ownerId !== userId) {
        const { data: liker } = await supabase
          .from('profiles')
          .select('name, username')
          .eq('user_id', userId)
          .maybeSingle();
        const label = liker?.name?.trim() || liker?.username || 'Someone';
        await createInAppNotification({
          userId: ownerId,
          actorId: userId,
          type: 'highlight_like',
          entityType: 'highlight',
          entityId: highlightId,
          title: `${label} liked your highlight`,
          body: null,
        });
      }

      return { success: true, newLikedState: true };
    }
  } catch (err) {
    if (__DEV__) console.warn('[highlights] toggle like', err);
    return { success: false, newLikedState: currentlyLiked };
  }
}

// ============================================================================
// VIEW COUNT
// ============================================================================

/** Format view count for display (e.g. 200, 1.5K, 12K). */
export function formatViewCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`;
  }
  const m = n / 1_000_000;
  return m % 1 === 0 ? `${m}M` : `${m.toFixed(1)}M`;
}

/**
 * Record a view for a highlight (call when user opens the detail page).
 * - Authenticated only: anonymous views are not counted (safest, no inflation).
 * - Dedupe: at most one view per user per highlight per 24 hours.
 */
export async function recordHighlightView(
  highlightId: string,
  userId?: string | null
): Promise<void> {
  try {
    if (!userId) return; // anonymous: don't count (avoids fake/inflated counts)

    const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existing } = await supabase
      .from('highlight_views')
      .select('id')
      .eq('highlight_id', highlightId)
      .eq('user_id', userId)
      .gte('viewed_at', windowStart)
      .limit(1)
      .maybeSingle();

    if (existing) return; // already viewed in last 24h

    await supabase.from('highlight_views').insert({
      highlight_id: highlightId,
      user_id: userId,
    });
  } catch (err) {
    if (__DEV__) console.warn('[highlights] record view', err);
  }
}

// ============================================================================
// COMMENTS
// ============================================================================

export async function loadHighlightComments(
  highlightId: string
): Promise<HighlightComment[]> {
  try {
    const selectCols = 'id, highlight_id, user_id, body, created_at, parent_id';
    const { data: comments, error } = await supabase
      .from('highlight_comments')
      .select(selectCols)
      .eq('highlight_id', highlightId)
      .order('created_at', { ascending: true }); // oldest first (chat style)

    if (error) {
      if (error.code === 'PGRST205' || error.message?.includes('highlight_comments') || error.message?.includes('parent_id')) {
        const { data: fallback } = await supabase
          .from('highlight_comments')
          .select('id, highlight_id, user_id, body, created_at')
          .eq('highlight_id', highlightId)
          .order('created_at', { ascending: true });
        const list = (fallback || []).map((c: any) => ({ ...c, parent_id: null as string | null, parent_username: null as string | null }));
        return enrichCommentsWithProfiles(list);
      }
      throw error;
    }

    if (!comments || comments.length === 0) {
      return [];
    }

    const userIds = [...new Set(comments.map((c: any) => c.user_id))];
    const parentIds = [...new Set((comments as any[]).map((c: any) => c.parent_id).filter(Boolean))] as string[];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, username, avatar_url, rep_level')
      .in('user_id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    let parentUsernames: Map<string, string> = new Map();
    if (parentIds.length > 0) {
      const { data: parentComments } = await supabase
        .from('highlight_comments')
        .select('id, user_id')
        .in('id', parentIds);
      const parentUserIds = [...new Set((parentComments || []).map((p: any) => p.user_id))];
      const { data: parentProfiles } = await supabase
        .from('profiles')
        .select('user_id, username, name')
        .in('user_id', parentUserIds);
      const parentProfileMap = new Map((parentProfiles || []).map((p: any) => [p.user_id, p]));
      (parentComments || []).forEach((pc: any) => {
        const pro = parentProfileMap.get(pc.user_id);
        parentUsernames.set(pc.id, pro?.username || pro?.name || 'User');
      });
    }

    return comments.map((c: any) => {
      const p = profileMap.get(c.user_id);
      const parentUsername = c.parent_id ? parentUsernames.get(c.parent_id) || null : null;
      return {
        ...c,
        parent_id: c.parent_id ?? null,
        profile_name: p?.name || null,
        profile_username: p?.username || null,
        profile_avatar_url: p?.avatar_url || null,
        profile_rep_level: (p as { rep_level?: string | null } | undefined)?.rep_level ?? null,
        parent_username: parentUsername ?? null,
      };
    });
  } catch (err) {
    if (__DEV__) console.warn('[highlights] load comments', err);
    return [];
  }
}

async function enrichCommentsWithProfiles(comments: any[]): Promise<HighlightComment[]> {
  if (comments.length === 0) return [];
  const userIds = [...new Set(comments.map((c: any) => c.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, name, username, avatar_url, rep_level')
    .in('user_id', userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return comments.map((c: any) => {
    const p = profileMap.get(c.user_id);
    return {
      ...c,
      profile_name: p?.name || null,
      profile_username: p?.username || null,
      profile_avatar_url: p?.avatar_url || null,
      profile_rep_level: (p as { rep_level?: string | null } | undefined)?.rep_level ?? null,
      parent_username: c.parent_username ?? null,
    };
  });
}

export async function addHighlightComment(
  highlightId: string,
  userId: string,
  body: string,
  parentId?: string | null
): Promise<{ success: boolean; comment?: HighlightComment }> {
  try {
    const cleaned = sanitizeText(body, SANITIZE_LIMITS.highlightComment, { multiline: true });
    if (!cleaned || isOffensiveContent(cleaned)) {
      return { success: false };
    }
    const insert: { highlight_id: string; user_id: string; body: string; parent_id?: string } = {
      highlight_id: highlightId,
      user_id: userId,
      body: cleaned,
    };
    if (parentId) insert.parent_id = parentId;

    const { data, error } = await supabase
      .from('highlight_comments')
      .insert(insert)
      .select('id, highlight_id, user_id, body, created_at, parent_id')
      .single();

    if (error) throw error;

    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username, avatar_url, rep_level')
      .eq('user_id', userId)
      .single();

    const { data: highlightOwner } = await supabase
      .from('highlights')
      .select('user_id')
      .eq('id', highlightId)
      .maybeSingle();
    const ownerId = highlightOwner?.user_id;
    if (ownerId && ownerId !== userId) {
      const label = profile?.name?.trim() || profile?.username || 'Someone';
      const preview =
        cleaned.length > 120 ? `${cleaned.slice(0, 117)}...` : cleaned;
      await createInAppNotification({
        userId: ownerId,
        actorId: userId,
        type: 'highlight_comment',
        entityType: 'highlight',
        entityId: highlightId,
        title: `${label} commented on your highlight`,
        body: preview,
      });
    }

    let parent_username: string | null = null;
    if (data.parent_id) {
      const { data: parentRow } = await supabase
        .from('highlight_comments')
        .select('user_id')
        .eq('id', data.parent_id)
        .maybeSingle();
      if (parentRow) {
        const { data: parentProf } = await supabase
          .from('profiles')
          .select('username, name')
          .eq('user_id', parentRow.user_id)
          .maybeSingle();
        parent_username = parentProf?.username || parentProf?.name || null;
      }
    }

    return {
      success: true,
      comment: {
        ...data,
        parent_id: data.parent_id ?? null,
        profile_name: profile?.name || null,
        profile_username: profile?.username || null,
        profile_avatar_url: profile?.avatar_url || null,
        profile_rep_level: profile?.rep_level ?? null,
        parent_username,
      },
    };
  } catch (err) {
    if (__DEV__) console.warn('[highlights] add comment', err);
    return { success: false };
  }
}

export async function deleteHighlightComment(
  commentId: string,
  userId: string
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('highlight_comments')
      .delete()
      .eq('id', commentId)
      .eq('user_id', userId);
    if (error) throw error;
    return true;
  } catch (err) {
    if (__DEV__) console.warn('[highlights] delete comment', err);
    return false;
  }
}

export async function getCommentCount(highlightId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('highlight_comments')
      .select('*', { count: 'exact', head: true })
      .eq('highlight_id', highlightId);
    if (error) {
      if (error.code === 'PGRST205') return 0;
      throw error;
    }
    return count || 0;
  } catch (error) {
    if (__DEV__) console.warn('[highlights:getLikeCount]', error);
    return 0;
  }
}

// ============================================================================
// PREVIEW (for DM / link cards)
// ============================================================================

export type HighlightPreview = {
  id: string;
  user_id: string;
  sport: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  profile_name: string | null;
  profile_username: string | null;
};

/** Fetch minimal highlight data for preview cards (e.g. in chat). */
export async function getHighlightPreview(highlightId: string): Promise<HighlightPreview | null> {
  try {
    const { data: row, error } = await supabase
      .from('highlights')
      .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption')
      .eq('id', highlightId)
      .maybeSingle();
    if (error || !row) return null;
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, username')
      .eq('user_id', row.user_id)
      .maybeSingle();
    return {
      ...row,
      profile_name: profile?.name ?? null,
      profile_username: profile?.username ?? null,
    } as HighlightPreview;
  } catch (error) {
    if (__DEV__) console.warn('[highlights:getHighlightPreview]', error);
    return null;
  }
}
