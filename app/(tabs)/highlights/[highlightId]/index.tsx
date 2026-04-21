import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Dimensions,
  Share,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Image } from 'expo-image';
import { HighlightDetailVideo } from '@/components/HighlightDetailVideo';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { resolveMediaUrlForPlayback } from '@/lib/storage-media-url';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import {
  loadHighlightComments,
  addHighlightComment,
  recordHighlightView,
  formatViewCount,
  toggleHighlightLike,
  type HighlightComment,
} from '@/lib/highlights';
import { repostHighlight, undoRepost, hasUserReposted } from '@/lib/reposts';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { HighlightDetailSkeleton } from '@/components/skeletons/HighlightDetailSkeleton';
import { hapticLight } from '@/lib/haptics';
import { logger } from '@/lib/logger';
import { playrateHighlightUrl } from '@/lib/deep-links';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { TierBadge } from '@/components/ui/TierBadge';

/** Card horizontal inset from screen — full-bleed media width matches Card outer edge. */
const DETAIL_CARD_SCREEN_MARGIN = Spacing.md;
const DETAIL_MEDIA_HEIGHT_PER_WIDTH = 1.1;
const DETAIL_MEDIA_MAX_VIEWPORT_RATIO = 0.5;

function computeDetailMediaLayout(): { bleedWidth: number; mediaHeight: number } {
  const { width: sw, height: sh } = Dimensions.get('window');
  const bleedWidth = Math.round(sw - DETAIL_CARD_SCREEN_MARGIN * 2);
  const mediaHeight = Math.round(
    Math.min(bleedWidth * DETAIL_MEDIA_HEIGHT_PER_WIDTH, sh * DETAIL_MEDIA_MAX_VIEWPORT_RATIO)
  );
  return { bleedWidth, mediaHeight };
}

type Highlight = {
  id: string;
  user_id: string;
  sport: string;
  media_type: string;
  media_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  like_count: number;
  view_count: number;
  repost_count: number;
  profile_name: string | null;
  profile_username: string | null;
  profile_avatar_url: string | null;
  profile_rep_level: string | null;
};

/** Video URL must not be passed as Image poster (avoids invalid poster + layout jump). */
function HighlightVideo({
  uri,
  posterImageUri,
  isActive,
}: {
  uri: string;
  posterImageUri: string | null;
  isActive: boolean;
}) {
  const resolvedPoster = useResolvedMediaUri(posterImageUri);
  if (!uri) {
    if (resolvedPoster) {
      return (
        <Image
          source={{ uri: resolvedPoster }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }
  return (
    <HighlightDetailVideo
      uri={uri}
      posterUri={posterImageUri}
      contentFit="cover"
      isActive={isActive}
    />
  );
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/**
 * Highlight detail within the Highlights tab stack.
 * Back button returns to Highlights feed (router.back()).
 */
export default function HighlightDetailInStackScreen() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [highlight, setHighlight] = useState<Highlight | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [togglingLike, setTogglingLike] = useState(false);
  const [repostCount, setRepostCount] = useState(0);
  const [hasReposted, setHasReposted] = useState(false);
  const [togglingRepost, setTogglingRepost] = useState(false);
  const [comments, setComments] = useState<HighlightComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsLoadError, setCommentsLoadError] = useState(false);
  const [highlightLoadError, setHighlightLoadError] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const scrollBottomPadding = useScrollContentBottomPadding();
  const isFocused = useIsFocused();
  const [detailMediaLayout, setDetailMediaLayout] = useState(computeDetailMediaLayout);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setDetailMediaLayout(computeDetailMediaLayout());
    });
    return () => sub.remove();
  }, []);

  const loadHighlight = useCallback(async () => {
    if (!highlightId) return;
    setLoading(true);
    setHighlightLoadError(false);
    try {
      const { data: h, error } = await supabase
        .from('highlights')
        .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at')
        .eq('id', highlightId)
        .maybeSingle();

      if (error) {
        logger.error('[highlight-detail] primary fetch failed', { err: error, highlightId });
        setHighlight(null);
        setPlaybackUri(null);
        setHighlightLoadError(true);
        setLoading(false);
        return;
      }
      if (!h) {
        setHighlight(null);
        setPlaybackUri(null);
        setHighlightLoadError(false);
        setLoading(false);
        return;
      }

      const viewsPromise = (async () => {
        try {
          const res = await supabase
            .from('highlight_views')
            .select('*', { count: 'exact', head: true })
            .eq('highlight_id', highlightId);
          return res.count ?? 0;
        } catch {
          return 0;
        }
      })();

      const playbackPromise = resolveMediaUrlForPlayback(h.media_url).catch(() => h.media_url);

      const likesPromise = supabase
        .from('highlight_likes')
        .select('*', { count: 'exact', head: true })
        .eq('highlight_id', highlightId);

      const profilePromise = supabase
        .from('profiles')
        .select('name, username, avatar_url, rep_level')
        .eq('user_id', h.user_id)
        .maybeSingle();

      const userLikePromise = user
        ? supabase
            .from('highlight_likes')
            .select('user_id')
            .eq('highlight_id', highlightId)
            .eq('user_id', user.id)
            .maybeSingle()
        : Promise.resolve({ data: null });

      const repostCountPromise = supabase
        .from('highlight_reposts')
        .select('*', { count: 'exact', head: true })
        .eq('highlight_id', highlightId);

      const userRepostedPromise =
        user && highlightId ? hasUserReposted(highlightId, user.id) : Promise.resolve(false);

      const [resolvedPlayback, likesRes, vCount, profile, likeRow, repostCountRes, didRepost] =
        await Promise.all([
          playbackPromise,
          likesPromise,
          viewsPromise,
          profilePromise,
          userLikePromise,
          repostCountPromise,
          userRepostedPromise,
        ]);

      const count = likesRes.count ?? 0;
      const userLiked = !!likeRow.data;

      const rc = repostCountRes.error ? 0 : (repostCountRes.count ?? 0);
      setHighlight({
        ...h,
        like_count: count || 0,
        view_count: vCount || 0,
        repost_count: rc,
        profile_name: profile.data?.name || null,
        profile_username: profile.data?.username || null,
        profile_avatar_url: profile.data?.avatar_url || null,
        profile_rep_level: (profile.data as { rep_level?: string | null } | null)?.rep_level ?? null,
      });
      setLikeCount(count || 0);
      setViewCount(vCount || 0);
      setRepostCount(rc);
      setHasReposted(didRepost);
      setIsLiked(userLiked);
      setPlaybackUri(resolvedPlayback);
    } catch (err) {
      logger.error('[highlight-detail] load threw', { err, highlightId });
      setHighlight(null);
      setPlaybackUri(null);
      setHighlightLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [highlightId, user]);

  const loadComments = useCallback(async () => {
    if (!highlightId) return;
    setCommentsLoading(true);
    setCommentsLoadError(false);
    try {
      const data = await loadHighlightComments(highlightId);
      setComments(data);
    } catch (err) {
      logger.error('[highlight-detail] comments load failed', { err, highlightId });
      setCommentsLoadError(true);
      setComments([]);
    } finally {
      setCommentsLoading(false);
    }
  }, [highlightId]);

  useEffect(() => {
    void loadHighlight();
  }, [loadHighlight]);

  useEffect(() => {
    if (highlightId) recordHighlightView(highlightId, user?.id ?? null);
  }, [highlightId, user]);

  useEffect(() => {
    // Use highlightId + loading, not full highlight object, to avoid re-fetching comments on every
    // setHighlight identity change while keeping the same id.
    if (!loading && highlightId) loadComments();
  }, [highlightId, loading, loadComments]);

  const toggleLike = async () => {
    if (!user || !highlightId || togglingLike) return;
    hapticLight();

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));
    setTogglingLike(true);

    try {
      const { success, newLikedState } = await toggleHighlightLike(
        highlightId,
        user.id,
        wasLiked
      );
      if (!success) {
        setIsLiked(wasLiked);
        setLikeCount((c) => c + (wasLiked ? 1 : -1));
        Alert.alert('Error', 'Could not update like.');
      } else {
        setIsLiked(newLikedState);
      }
    } catch (error) {
      if (__DEV__) console.warn('[highlight-detail:toggleLike]', error);
      setIsLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      Alert.alert('Error', 'Could not update like.');
    } finally {
      setTogglingLike(false);
    }
  };

  const toggleRepost = async () => {
    if (!user || !highlightId || togglingRepost) return;
    hapticLight();
    const next = !hasReposted;
    setHasReposted(next);
    setRepostCount((c) => Math.max(0, c + (next ? 1 : -1)));
    setTogglingRepost(true);
    try {
      if (next) {
        await repostHighlight(highlightId, user.id);
      } else {
        await undoRepost(highlightId, user.id);
      }
    } catch (e) {
      if (__DEV__) console.warn('[highlight-detail:toggleRepost]', e);
      setHasReposted(!next);
      setRepostCount((c) => Math.max(0, c + (next ? -1 : 1)));
      Alert.alert('Error', 'Could not update repost. Try again.');
    } finally {
      setTogglingRepost(false);
    }
  };

  const handleSendComment = async () => {
    if (!user || !highlightId || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    const text = commentText.trim();
    const parentId = replyingToId;
    setCommentText('');
    setReplyingToId(null);
    try {
      const result = await addHighlightComment(highlightId, user.id, text, parentId || undefined);
      if (result.success && result.comment) {
        setComments((prev) => [...prev, result.comment!]);
      }
    } finally {
      setSendingComment(false);
    }
  };

  const handleShare = async () => {
    if (!highlight) return;
    try {
      await Share.share({
        title: 'Highlight',
        message: `Check out this highlight. ${playrateHighlightUrl(highlight.id)}`,
      });
    } catch (error) {
      if (__DEV__) console.warn('[highlight-detail:share]', error);
    }
  };

  const handleDm = () => {
    if (!highlightId) return;
    if (!user) {
      Alert.alert('Sign In Required', 'Sign in to send highlights via DM.');
      return;
    }
    router.push({ pathname: '/highlights/send-dm', params: { highlightId } });
  };

  if (loading) {
    return (
      <Screen>
        <Header title="Highlight" />
        <HighlightDetailSkeleton />
      </Screen>
    );
  }

  if (highlightLoadError) {
    return (
      <Screen>
        <Header title="Highlight" />
        <View style={[styles.center, { flex: 1 }]}>
          <ErrorState onRetry={() => void loadHighlight()} />
        </View>
      </Screen>
    );
  }

  if (!highlight) {
    return (
      <Screen>
        <Header title="Highlight" />
        <View style={[styles.center, { flex: 1 }]}>
          <EmptyState
            title="This highlight isn't available"
            subtitle="It may have been deleted or you may not have access."
            actionLabel="Go back"
            onAction={() => router.back()}
            icon="play.rectangle.fill"
          />
        </View>
      </Screen>
    );
  }

  const isOwn = user?.id === highlight.user_id;

  const renderComment = ({ item }: { item: HighlightComment }) => (
    <View style={styles.commentRow}>
      <TouchableOpacity onPress={() => router.push(`/athletes/${item.user_id}/profile`)} activeOpacity={0.7}>
        <ProfilePicture avatarUrl={item.profile_avatar_url} size={32} editable={false} />
      </TouchableOpacity>
      <View
        style={[
          styles.commentContent,
          item.parent_id && { marginLeft: Spacing.md, paddingLeft: Spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border },
        ]}
      >
        <View style={styles.commentHeader}>
          <TouchableOpacity
            style={styles.commentAuthorTouch}
            onPress={() => router.push(`/athletes/${item.user_id}/profile`)}
          >
            <View style={styles.commentNameRow}>
              <Text style={[styles.commentUsername, { color: colors.text }]} numberOfLines={1}>
                {item.profile_name || item.profile_username || 'User'}
              </Text>
              <TierBadge tierName={item.profile_rep_level} size="sm" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>{formatTimeAgo(item.created_at)}</Text>
        </View>
        {item.parent_username ? (
          <Text style={[styles.commentReplyTo, { color: colors.textMuted }]}>Replying to @{item.parent_username}</Text>
        ) : null}
        <Text style={[styles.commentBody, { color: colors.text }]}>{item.body}</Text>
        {user ? (
          <TouchableOpacity
            style={styles.replyButton}
            onPress={() => setReplyingToId(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[styles.replyButtonText, { color: colors.primary }]}>Reply</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );

  return (
    <Screen>
      <Header title="Highlight" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPadding + Spacing.lg }]}
          showsVerticalScrollIndicator={false}
        >
          <Card style={styles.card}>
            <TouchableOpacity
              style={styles.profileRow}
              onPress={() => router.push(`/athletes/${highlight.user_id}/profile`)}
              activeOpacity={0.7}
            >
              <ProfilePicture avatarUrl={highlight.profile_avatar_url} size={40} editable={false} />
              <View style={styles.profileText}>
                <View style={styles.profileNameRow}>
                  <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                    {highlight.profile_name || 'Unknown'}
                  </Text>
                  <TierBadge tierName={highlight.profile_rep_level} size="sm" />
                </View>
                <Text style={[styles.profileUsername, { color: colors.textMuted }]}>@{highlight.profile_username || 'user'}</Text>
              </View>
            </TouchableOpacity>

            <View
              style={[
                styles.mediaContainer,
                {
                  width: detailMediaLayout.bleedWidth,
                  height: detailMediaLayout.mediaHeight,
                  marginHorizontal: -Spacing.lg,
                },
              ]}
            >
              {highlight.media_type === 'video' ? (
                <HighlightVideo
                  uri={playbackUri || highlight.media_url}
                  posterImageUri={highlight.thumbnail_url}
                  isActive={isFocused}
                />
              ) : (
                <Image
                  source={{ uri: playbackUri || highlight.media_url }}
                  style={styles.image}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
              )}
            </View>

            <View style={styles.actions}>
              {viewCount > 0 ? (
                <View style={styles.viewCountWrap}>
                  <IconSymbol name="eye.fill" size={16} color={colors.textMuted} />
                  <Text style={[styles.viewCountText, { color: colors.textMuted }]}>{formatViewCount(viewCount)} views</Text>
                </View>
              ) : null}
              {!isOwn && (
                <TouchableOpacity style={styles.likeButton} onPress={toggleLike} disabled={togglingLike}>
                  <IconSymbol name={isLiked ? 'star.fill' : 'star'} size={24} color={isLiked ? colors.accentPink : colors.textMuted} />
                </TouchableOpacity>
              )}
              <Text style={[styles.likeCount, { color: colors.textMuted }]}>{likeCount} likes</Text>
              <View style={styles.commentCountWrap}>
                <IconSymbol name="bubble.left.fill" size={22} color={colors.textMuted} />
                <Text style={[styles.commentCountText, { color: colors.textMuted }]}>{comments.length}</Text>
              </View>
              {user ? (
                <AnimatedPressable
                  style={styles.repostActionWrap}
                  onPress={toggleRepost}
                  disabled={togglingRepost}
                  accessibilityRole="button"
                  accessibilityLabel={hasReposted ? 'Undo repost' : 'Repost highlight'}
                >
                  <IconSymbol
                    name="arrow.2.squarepath"
                    size={22}
                    color={hasReposted ? colors.accentOrange : colors.textMuted}
                  />
                  <Text
                    style={[
                      styles.repostCountInline,
                      { color: hasReposted ? colors.accentOrange : colors.textMuted },
                    ]}
                  >
                    {repostCount}
                  </Text>
                </AnimatedPressable>
              ) : null}
              <View style={styles.shareDmRow}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleDm}
                  accessibilityRole="button"
                  accessibilityLabel="Send via DM"
                >
                  <IconSymbol name="envelope.fill" size={22} color={colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleShare}
                  accessibilityRole="button"
                  accessibilityLabel="Share highlight"
                >
                  <IconSymbol name="square.and.arrow.up" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {highlight.caption ? (
              <Text style={[styles.caption, { color: colors.text }]}>{highlight.caption}</Text>
            ) : null}
            <Text style={[styles.sport, { color: colors.textMuted }]}>{highlight.sport}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(highlight.created_at).toLocaleDateString()}</Text>
          </Card>

          <View style={[styles.commentsSection, { borderTopColor: colors.border }]}>
            <Text style={[styles.commentsSectionTitle, { color: colors.text }]}>Comments</Text>
            {commentsLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.commentsLoader} />
            ) : commentsLoadError ? (
              <ErrorState onRetry={() => void loadComments()} />
            ) : comments.length === 0 ? (
              <EmptyState
                title="No comments yet. Start the conversation!"
                subtitle="Be the first to leave a reply on this highlight."
              />
            ) : (
              comments.map((item) => <View key={item.id}>{renderComment({ item })}</View>)
            )}
            {user ? (
              <View style={styles.commentInputRow}>
                {replyingToId ? (
                  <TouchableOpacity onPress={() => setReplyingToId(null)} style={styles.cancelReply}>
                    <Text style={[styles.cancelReplyText, { color: colors.textMuted }]}>Cancel reply</Text>
                  </TouchableOpacity>
                ) : null}
                <TextInput
                  style={[styles.commentInput, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
                  placeholder="Add a comment..."
                  placeholderTextColor={colors.textMuted}
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                  maxLength={500}
                  editable={!sendingComment}
                />
                <TouchableOpacity
                  style={[styles.sendCommentBtn, { backgroundColor: commentText.trim() ? colors.primary : colors.surfaceAlt }]}
                  onPress={handleSendComment}
                  disabled={!commentText.trim() || sendingComment}
                >
                  {sendingComment ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <IconSymbol name="paperplane.fill" size={18} color={commentText.trim() ? '#fff' : colors.textMuted} />
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={() => router.push('/sign-in')}>
                <Text style={[styles.signInToComment, { color: colors.primary }]}>Sign in to comment</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center', alignItems: 'center' },
  errorText: { ...Typography.body },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: Spacing.xl },
  card: { margin: Spacing.md },
  profileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md },
  profileText: { marginLeft: Spacing.md, flex: 1, minWidth: 0 },
  profileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  profileName: { ...Typography.bodyBold, flexShrink: 1 },
  profileUsername: { ...Typography.mutedSmall },
  mediaContainer: {
    alignSelf: 'center',
    maxWidth: '100%',
    borderRadius: Radius.sm,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  image: { width: '100%', height: '100%' },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: Spacing.md, flexWrap: 'wrap', gap: Spacing.sm },
  viewCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewCountText: { ...Typography.mutedSmall },
  likeButton: { marginRight: Spacing.xs },
  likeCount: { ...Typography.muted },
  commentCountWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentCountText: { ...Typography.mutedSmall },
  shareDmRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 'auto', gap: Spacing.sm },
  repostActionWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: Spacing.xs },
  repostCountInline: { ...Typography.mutedSmall, fontWeight: '600' },
  actionButton: { padding: Spacing.xs },
  caption: { ...Typography.body, marginTop: Spacing.sm },
  sport: { ...Typography.mutedSmall, marginTop: Spacing.xs },
  date: { ...Typography.mutedSmall, marginTop: Spacing.xs },
  commentsSection: { marginHorizontal: Spacing.md, marginTop: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1 },
  commentsSectionTitle: { ...Typography.bodyBold, marginBottom: Spacing.sm },
  commentsLoader: { marginVertical: Spacing.md },
  commentRow: { flexDirection: 'row', marginBottom: Spacing.md },
  commentContent: { flex: 1, marginLeft: Spacing.sm },
  commentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  commentAuthorTouch: { flex: 1, minWidth: 0, marginRight: Spacing.sm },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  commentUsername: { ...Typography.bodyBold, fontSize: 13, flexShrink: 1 },
  commentTime: { ...Typography.mutedSmall, fontSize: 11 },
  commentReplyTo: { fontSize: 12, marginBottom: 2 },
  commentBody: { ...Typography.body, fontSize: 14, lineHeight: 20 },
  replyButton: { marginTop: 4 },
  replyButtonText: { fontSize: 12, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm },
  cancelReply: { marginBottom: 4 },
  cancelReplyText: { fontSize: 12 },
  commentInput: { flex: 1, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, maxHeight: 100, fontSize: 14 },
  sendCommentBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  noComments: { ...Typography.muted, marginVertical: Spacing.sm },
  signInToComment: { ...Typography.bodyBold, marginTop: Spacing.sm },
});
