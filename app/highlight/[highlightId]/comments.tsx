import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import {
  loadHighlightComments,
  addHighlightComment,
  HighlightComment,
} from '@/lib/highlights';
import { track } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { TierBadge } from '@/components/ui/TierBadge';

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

export default function HighlightCommentsScreen() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const flatListRef = useRef<FlatList>(null);

  const [comments, setComments] = useState<HighlightComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);

  useEffect(() => {
    if (highlightId) {
      loadComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const loadComments = async () => {
    if (!highlightId) return;
    setLoading(true);
    setLoadError(false);
    try {
      const data = await loadHighlightComments(highlightId);
      setComments(data);
    } catch (err) {
      logger.error('Highlight comments: load failed', { err, highlightId });
      setLoadError(true);
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!user || !highlightId || !inputText.trim() || sending) return;

    setSending(true);
    const text = inputText.trim();
    const parentId = replyingToId;
    setInputText('');
    setReplyingToId(null);

    try {
      const result = await addHighlightComment(highlightId, user.id, text, parentId || undefined);
      if (result.success && result.comment) {
        track('highlight_commented', { highlight_id: highlightId });
        setComments(prev => [...prev, result.comment!]);
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    } catch (err) {
      logger.error('Highlight comments: send failed', { err, highlightId });
      setInputText(text);
      if (parentId) setReplyingToId(parentId);
    } finally {
      setSending(false);
    }
  };

  const renderComment = ({ item }: { item: HighlightComment }) => (
    <View style={styles.commentRow}>
      <TouchableOpacity
        onPress={() => router.push(`/athletes/${item.user_id}/profile` as any)}
        activeOpacity={0.7}
      >
        <ProfilePicture avatarUrl={item.profile_avatar_url} size={36} editable={false} />
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
            onPress={() => router.push(`/athletes/${item.user_id}/profile` as any)}
          >
            <View style={styles.commentNameRow}>
              <Text style={[styles.commentUsername, { color: colors.text }]} numberOfLines={1}>
                {item.profile_name || item.profile_username || 'User'}
              </Text>
              <TierBadge tierName={item.profile_rep_level} size="sm" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.commentTime, { color: colors.textMuted }]}>
            {formatTimeAgo(item.created_at)}
          </Text>
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
      <Header title="Comments" showBack />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'position' : 'padding'}
        keyboardVerticalOffset={0}
      >
        <View style={[styles.listContainer, { backgroundColor: colors.bg }]}>
          {loading ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : loadError ? (
            <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
              <ErrorState onRetry={() => void loadComments()} />
            </View>
          ) : (
            <FlatList
              contentInsetAdjustmentBehavior="never"
              ref={flatListRef}
              data={comments}
              keyExtractor={item => item.id}
              renderItem={renderComment}
              style={{ backgroundColor: colors.bg }}
              contentContainerStyle={[
                styles.listContent,
                comments.length === 0 && styles.emptyList,
                { backgroundColor: colors.bg, paddingBottom: Spacing.md },
              ]}
              ListEmptyComponent={
                <EmptyState
                  title="No comments yet. Start the conversation!"
                  subtitle="Share encouragement or ask a question about this highlight."
                />
              }
              onContentSizeChange={() => {
                if (comments.length > 0) {
                  flatListRef.current?.scrollToEnd({ animated: false });
                }
              }}
            />
          )}
        </View>

        {/* Input bar */}
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
              paddingBottom: scrollBottomPadding,
            },
          ]}
        >
          {user ? (
            <>
              {replyingToId ? (
                <TouchableOpacity onPress={() => setReplyingToId(null)} style={styles.cancelReply}>
                  <Text style={[styles.cancelReplyText, { color: colors.textMuted }]}>Cancel reply</Text>
                </TouchableOpacity>
              ) : null}
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceAlt,
                    color: colors.text,
                    borderColor: colors.border,
                  },
                ]}
                placeholder="Add a comment..."
                placeholderTextColor={colors.textMuted}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                editable={!sending}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() ? colors.primary : colors.surfaceAlt,
                  },
                ]}
                onPress={handleSend}
                disabled={!inputText.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.textOnPrimary} />
                ) : (
                  <IconSymbol
                    name="paperplane.fill"
                    size={18}
                    color={inputText.trim() ? colors.textOnPrimary : colors.textMuted}
                  />
                )}
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={styles.signInPrompt}
              onPress={() => router.push('/sign-in')}
            >
              <Text style={[styles.signInText, { color: colors.primary }]}>
                Sign in to comment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  commentContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthorTouch: { flex: 1, minWidth: 0, marginRight: Spacing.sm },
  commentNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 0 },
  commentUsername: {
    ...Typography.bodyBold,
    fontSize: 13,
    flexShrink: 1,
  },
  commentTime: {
    ...Typography.mutedSmall,
    fontSize: 11,
  },
  commentBody: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 20,
  },
  commentReplyTo: { fontSize: 12, marginBottom: 2 },
  replyButton: { marginTop: 4 },
  replyButtonText: { fontSize: 12, fontWeight: '600' },
  cancelReply: { marginBottom: 4 },
  cancelReplyText: { fontSize: 12 },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    ...Typography.body,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signInPrompt: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  signInText: {
    ...Typography.bodyBold,
  },
});
