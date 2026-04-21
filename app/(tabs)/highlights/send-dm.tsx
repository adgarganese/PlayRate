import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TextInput,
  Alert,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useAuth } from '@/contexts/auth-context';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Button } from '@/components/ui/Button';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import {
  getMessageableUsers,
  getOrCreateConversation,
  sendMessage,
  HIGHLIGHT_LINK_PREFIX,
  type MessageableUser,
} from '@/lib/dms';
import { getHighlightPreview, type HighlightPreview } from '@/lib/highlights';
import { hapticMedium } from '@/lib/haptics';
import { isRpcRateLimitError, RPC_RATE_LIMIT_USER_MESSAGE } from '@/lib/rpc-rate-limit';
import { useResolvedMediaUri } from '@/hooks/useResolvedMediaUri';
import { pickHighlightStillImageRaw } from '@/lib/highlight-still';
import { useScrollContentBottomPadding } from '@/hooks/use-scroll-bottom-padding';

const SEND_DM_VIDEO_FALLBACK = '#0B0F1A';

const SendDmHighlightThumb = memo(function SendDmHighlightThumb({ highlight }: { highlight: HighlightPreview }) {
  const { colors } = useThemeColors();
  const raw = useMemo(
    () => pickHighlightStillImageRaw(highlight.thumbnail_url, highlight.media_url, highlight.media_type),
    [highlight.thumbnail_url, highlight.media_url, highlight.media_type]
  );
  const uri = useResolvedMediaUri(raw);
  const isVideo = highlight.media_type === 'video';

  if (uri) {
    return <Image source={{ uri }} style={styles.previewThumb} contentFit="cover" cachePolicy="memory-disk" />;
  }

  return (
    <View
      style={[
        styles.previewThumb,
        styles.previewThumbPlaceholder,
        {
          backgroundColor: isVideo ? SEND_DM_VIDEO_FALLBACK : colors.surface,
        },
      ]}
    >
      <IconSymbol
        name={isVideo ? 'play.rectangle.fill' : 'photo'}
        size={24}
        color={isVideo ? 'rgba(255,255,255,0.88)' : colors.textMuted}
      />
      {isVideo && highlight.caption?.trim() ? (
        <Text numberOfLines={2} style={styles.previewThumbCaption}>
          {highlight.caption.trim()}
        </Text>
      ) : null}
    </View>
  );
});

export default function SendHighlightDmScreen() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const scrollBottomPadding = useScrollContentBottomPadding();
  const [highlight, setHighlight] = useState<HighlightPreview | null>(null);
  const [users, setUsers] = useState<MessageableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const id = highlightId ?? '';

  useEffect(() => {
    if (!user) {
      router.replace('/sign-in');
      return;
    }
    if (!id) {
      router.back();
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [preview, list] = await Promise.all([
          getHighlightPreview(id),
          getMessageableUsers(user.id),
        ]);
        if (!cancelled) {
          setHighlight(preview ?? null);
          setUsers(list);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, id, router]);

  const filtered = query.trim()
    ? users.filter(
        (u) =>
          (u.name?.toLowerCase().includes(query.toLowerCase()) ||
           u.username?.toLowerCase().includes(query.toLowerCase()))
      )
    : users;

  const handleSend = useCallback(async () => {
    if (!user || !id || !selectedUserId || sending) return;
    setSending(true);
    try {
      const conversationId = await getOrCreateConversation(user.id, selectedUserId);
      await sendMessage(conversationId, user.id, HIGHLIGHT_LINK_PREFIX + id);
      hapticMedium();
      Alert.alert('Sent', 'Highlight sent.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      if (
        isRpcRateLimitError(error) ||
        (error instanceof Error && error.message === RPC_RATE_LIMIT_USER_MESSAGE)
      ) {
        Alert.alert('Slow down', RPC_RATE_LIMIT_USER_MESSAGE);
      } else {
        if (__DEV__) console.warn('[highlights-send-dm]', error);
        Alert.alert('Error', 'Could not send. Please try again.');
      }
    } finally {
      setSending(false);
    }
  }, [user, id, selectedUserId, sending, router]);

  if (!user || !id) return null;

  return (
    <Screen>
      <Header title="Send via DM" showBack />
      {loading && !highlight ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {/* Highlight preview */}
          {highlight && (
            <View style={[styles.previewCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.previewRow}>
                <SendDmHighlightThumb highlight={highlight} />
                <View style={styles.previewBody}>
                  <Text style={[styles.previewCreator, { color: colors.text }]} numberOfLines={1}>
                    {highlight.profile_name || highlight.profile_username || 'Unknown'}
                  </Text>
                  {highlight.caption ? (
                    <Text style={[styles.previewCaption, { color: colors.textMuted }]} numberOfLines={2}>
                      {highlight.caption}
                    </Text>
                  ) : null}
                  <Text style={[styles.previewSport, { color: colors.textMuted }]}>{highlight.sport}</Text>
                </View>
              </View>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textMuted }]}>Send to</Text>
          <TextInput
            style={[styles.searchInput, { backgroundColor: colors.surfaceAlt, color: colors.text, borderColor: colors.border }]}
            placeholder="Search by name or username"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.user_id}
            style={styles.list}
            contentContainerStyle={{ paddingBottom: Spacing.md }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[Typography.muted, { color: colors.textMuted }]}>
                  {users.length === 0 ? 'No one to message yet. Follow people to start.' : 'No matches.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const selected = selectedUserId === item.user_id;
              return (
                <Pressable
                  onPress={() => setSelectedUserId(selected ? null : item.user_id)}
                  style={({ pressed }) => [
                    styles.userRow,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    selected && { borderColor: colors.primary, borderWidth: 2 },
                    pressed && styles.pressed,
                  ]}
                >
                  <ProfilePicture avatarUrl={item.avatar_url} size={44} editable={false} />
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                      {item.name || item.username || 'User'}
                    </Text>
                    {item.username ? (
                      <Text style={[styles.userUsername, { color: colors.textMuted }]}>@{item.username}</Text>
                    ) : null}
                  </View>
                  {selected && <IconSymbol name="checkmark.circle.fill" size={24} color={colors.primary} />}
                </Pressable>
              );
            }}
          />
          <View style={[styles.footer, { paddingBottom: scrollBottomPadding }]}>
            <Button
              title={sending ? 'Sending…' : 'Send'}
              onPress={handleSend}
              variant="primary"
              disabled={!selectedUserId || sending}
              style={styles.sendButton}
            />
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  previewCard: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: Radius.sm,
    borderWidth: 1,
    padding: Spacing.md,
  },
  previewRow: { flexDirection: 'row', alignItems: 'center' },
  previewThumb: { width: 56, height: 56, borderRadius: Radius.xs, overflow: 'hidden' },
  previewThumbPlaceholder: { justifyContent: 'center', alignItems: 'center', padding: 4 },
  previewThumbCaption: {
    ...Typography.mutedSmall,
    fontSize: 9,
    lineHeight: 11,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginTop: 4,
  },
  previewBody: { flex: 1, marginLeft: Spacing.md, minWidth: 0 },
  previewCreator: { ...Typography.bodyBold },
  previewCaption: { ...Typography.mutedSmall, marginTop: 2 },
  previewSport: { ...Typography.mutedSmall, marginTop: 2 },
  label: { ...Typography.muted, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  searchInput: {
    ...Typography.body,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  list: { flex: 1 },
  empty: { padding: Spacing.xl, alignItems: 'center' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  userInfo: { flex: 1, marginLeft: Spacing.md, minWidth: 0 },
  userName: { ...Typography.bodyBold },
  userUsername: { ...Typography.mutedSmall },
  pressed: { opacity: 0.8 },
  footer: { padding: Spacing.lg },
  sendButton: {},
});
