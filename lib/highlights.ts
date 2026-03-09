import { supabase } from './supabase';

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
  profile_name: string | null;
  profile_username: string | null;
  profile_avatar_url: string | null;
  is_liked: boolean;
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

export async function loadHighlightsFeed(
  feedType: FeedType,
  currentUserId: string | null,
  offset: number,
  limit: number,
  options?: {
    followingIds?: string[];
    userLocation?: { lat: number; lng: number };
  }
): Promise<LoadHighlightsFeedResult> {
  try {
    // Helper to build query (view_count optional until migration is run)
    const buildQuery = (includeCommentCount: boolean, includeViewCount: boolean) => {
      let cols = 'id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at, like_count';
      if (includeCommentCount) cols += ', comment_count';
      if (includeViewCount) cols += ', view_count';
      const columns = cols;

      let q = supabase
        .from('highlights_with_counts')
        .select(cols)
        .eq('is_public', true);

      // Apply ordering based on feedType
      if (feedType === 'popular') {
        q = q.order('like_count', { ascending: false }).order('created_at', { ascending: false });
      } else if (feedType === 'friends_local' && options?.followingIds?.length) {
        q = q.in('user_id', options.followingIds).order('created_at', { ascending: false });
      } else {
        q = q.order('created_at', { ascending: false });
      }

      return q.range(offset, offset + limit - 1);
    };

    // Try with comment_count and view_count first
    let { data: rows, error } = await buildQuery(true, true);

    // If view_count column doesn't exist (migration not run), retry without it
    if (error?.code === '42703' && error.message?.includes('view_count')) {
      const result = await buildQuery(true, false);
      rows = result.data;
      error = result.error;
    }
    // If comment_count column doesn't exist, retry without it
    if (error?.code === '42703' && error.message?.includes('comment_count')) {
      const result = await buildQuery(false, false);
      rows = result.data;
      error = result.error;
    }

    if (__DEV__) {
      console.log('[HighlightsFeed] query result:', { rowCount: (rows || []).length, error: error?.message ?? null });
    }

    if (error) {
      if (__DEV__) console.warn('[highlights] load feed', error);
      return { highlights: [], hasMore: false, error: error.message ?? 'Failed to load highlights' };
    }

    const items = rows || [];
    const hasMore = items.length === limit;

    if (items.length === 0) {
      return { highlights: [], hasMore: false };
    }

    // Batch fetch profiles
    const userIds = [...new Set(items.map((h: any) => h.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, name, username, avatar_url')
      .in('user_id', userIds);
    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.user_id, p])
    );

    // Batch fetch user likes
    let userLikedIds = new Set<string>();
    if (currentUserId) {
      const { data: likes } = await supabase
        .from('highlight_likes')
        .select('highlight_id')
        .eq('user_id', currentUserId)
        .in('highlight_id', items.map((h: any) => h.id));
      (likes || []).forEach((l: any) => userLikedIds.add(l.highlight_id));
    }

    const feedItems: FeedHighlight[] = items.map((h: any) => {
      const p = profileMap.get(h.user_id);
      return {
        ...h,
        comment_count: h.comment_count ?? 0,
        view_count: h.view_count ?? 0,
        profile_name: p?.name || null,
        profile_username: p?.username || null,
        profile_avatar_url: p?.avatar_url || null,
        is_liked: userLikedIds.has(h.id),
      };
    });

    return { highlights: feedItems, hasMore };
  } catch (err) {
    if (__DEV__) console.warn('[highlights] load feed', err);
    const message = err instanceof Error ? err.message : 'Failed to load highlights';
    return { highlights: [], hasMore: false, error: message };
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
      .select('user_id, name, username, avatar_url')
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
    .select('user_id, name, username, avatar_url')
    .in('user_id', userIds);
  const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
  return comments.map((c: any) => {
    const p = profileMap.get(c.user_id);
    return {
      ...c,
      profile_name: p?.name || null,
      profile_username: p?.username || null,
      profile_avatar_url: p?.avatar_url || null,
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
    const insert: { highlight_id: string; user_id: string; body: string; parent_id?: string } = {
      highlight_id: highlightId,
      user_id: userId,
      body: body.trim(),
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
      .select('name, username, avatar_url')
      .eq('user_id', userId)
      .single();

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
