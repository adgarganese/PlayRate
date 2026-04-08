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
import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  type HighlightComment,
} from '@/lib/highlights';
import { repostHighlight, undoRepost, hasUserReposted } from '@/lib/reposts';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { HighlightDetailSkeleton } from '@/components/skeletons/HighlightDetailSkeleton';
import { hapticLight } from '@/lib/haptics';

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
};

/** Video URL must not be passed as Image poster (avoids invalid poster + layout jump). */
function HighlightVideo({ uri, posterImageUri }: { uri: string; posterImageUri: string | null }) {
  if (!uri) {
    if (posterImageUri) {
      return (
        <Image
          source={{ uri: posterImageUri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
        />
      );
    }
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]} />;
  }
  return (
    <Video
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      useNativeControls
      resizeMode={ResizeMode.COVER}
      posterSource={posterImageUri ? { uri: posterImageUri } : undefined}
      usePoster={!!posterImageUri}
      isLooping
      shouldPlay
      isMuted
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
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const [detailMediaLayout, setDetailMediaLayout] = useState(computeDetailMediaLayout);

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', () => {
      setDetailMediaLayout(computeDetailMediaLayout());
    });
    return () => sub.remove();
  }, []);

  const loadHighlight = async () => {
    if (!highlightId) return;
    setLoading(true);
    try {
      const { data: h, error } = await supabase
        .from('highlights')
        .select('id, user_id, sport, media_type, media_url, thumbnail_url, caption, created_at')
        .eq('id', highlightId)
        .maybeSingle();

      if (error || !h) {
        setHighlight(null);
        setPlaybackUri(null);
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
        .select('name, username, avatar_url')
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
      });
      setLikeCount(count || 0);
      setViewCount(vCount || 0);
      setRepostCount(rc);
      setHasReposted(didRepost);
      setIsLiked(userLiked);
      setPlaybackUri(resolvedPlayback);
    } catch (err) {
      if (__DEV__) console.warn('[highlight-detail] load', err);
      setHighlight(null);
      setPlaybackUri(null);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = useCallback(async () => {
    if (!highlightId) return;
    setCommentsLoading(true);
    try {
      const data = await loadHighlightComments(highlightId);
      setComments(data);
    } finally {
      setCommentsLoading(false);
    }
  }, [highlightId]);

  useEffect(() => {
    loadHighlight();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  useEffect(() => {
    if (highlightId) recordHighlightView(highlightId, user?.id ?? null);
  }, [highlightId, user?.id]);

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
      if (wasLiked) {
        await supabase
          .from('highlight_likes')
          .delete()
          .eq('highlight_id', highlightId)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('highlight_likes')
          .insert({ highlight_id: highlightId, user_id: user.id });
      }
    } catch (error) {
      if (__DEV__) console.warn('[highlight-detail:toggleLike]', error);
      setIsLiked(wasLiked);
      setLikeCount((c) => c - (wasLiked ? -1 : 1));
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
        message: `Check out this highlight. playrate://profile/highlights/${highlight.id}`,
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

  if (!highlight) {
    return (
      <Screen>
        <Header title="Highlight" />
        <View style={[styles.center, { flex: 1 }]}>
          <Text style={[styles.errorText, { color: colors.textMuted }]}>Highlight not found</Text>
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
          <TouchableOpacity onPress={() => router.push(`/athletes/${item.user_id}/profile`)}>
            <Text style={[styles.commentUsername, { color: colors.text }]}>
              {item.profile_name || item.profile_username || 'User'}
            </Text>
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
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.lg }]}
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
                <Text style={[styles.profileName, { color: colors.text }]}>{highlight.profile_name || 'Unknown'}</Text>
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
            ) : comments.length === 0 ? (
              <Text style={[styles.noComments, { color: colors.textMuted }]}>No comments yet. Be the first!</Text>
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
  profileText: { marginLeft: Spacing.md },
  profileName: { ...Typography.bodyBold },
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
  commentUsername: { ...Typography.bodyBold, fontSize: 13, marginRight: Spacing.sm },
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
