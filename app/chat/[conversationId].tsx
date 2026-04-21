import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ListRenderItem,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { useBadges } from '@/contexts/badge-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import {
  getMessages,
  sendMessage,
  markConversationRead,
  parseHighlightIdFromBody,
  parseCourtIdFromBody,
  type MessageRow,
} from '@/lib/dms';
import { track } from '@/lib/analytics';
import { hapticMedium } from '@/lib/haptics';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HighlightPreviewCard } from '@/components/HighlightPreviewCard';
import { CourtPreviewCard } from '@/components/CourtPreviewCard';
import { logger } from '@/lib/logger';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { isOffensiveContent, sanitizeText, SANITIZE_LIMITS } from '@/lib/sanitize';
import { normalizeCosignTierName } from '@/lib/tiers';
import { TierBadge } from '@/components/ui/TierBadge';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

type SenderMeta = {
  name: string | null;
  username: string | null;
  rep_level: string | null;
};

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
  senderLabel,
  senderRepLevel,
}: {
  message: MessageRow;
  isMine: boolean;
  senderLabel: string;
  senderRepLevel: string | null;
}) {
  const { colors } = useThemeColors();
  const highlightId = parseHighlightIdFromBody(message.body);
  const courtId = parseCourtIdFromBody(message.body);

  if (highlightId) {
    return (
      <HighlightPreviewCard
        highlightId={highlightId}
        isMine={isMine}
        createdAt={message.created_at}
      />
    );
  }

  if (courtId) {
    return (
      <CourtPreviewCard
        courtId={courtId}
        isMine={isMine}
        createdAt={message.created_at}
      />
    );
  }

  return (
    <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapRight : styles.bubbleWrapLeft]}>
      <View style={styles.senderRow}>
        <Text
          style={[
            styles.senderName,
            { color: isMine ? colors.textMuted : colors.text },
          ]}
          numberOfLines={1}
        >
          {senderLabel}
        </Text>
        <TierBadge tierName={senderRepLevel} size="sm" />
      </View>
      <View
        style={[
          styles.bubble,
          isMine
            ? { backgroundColor: colors.primary }
            : { backgroundColor: colors.surfaceAlt },
        ]}
      >
        <Text
          style={[
            styles.bubbleText,
            { color: isMine ? colors.textOnPrimary : colors.text },
          ]}
        >
          {message.body}
        </Text>
        <Text
          style={[
            styles.bubbleTime,
            { color: isMine ? 'rgba(255,255,255,0.8)' : colors.textMuted },
          ]}
        >
          {formatMessageTime(message.created_at)}
        </Text>
      </View>
    </View>
  );
});

const INPUT_BAR_MIN_HEIGHT = 56;
const LIST_PADDING_BOTTOM_EXTRA = 24;
/** Offset so input bar sits above keyboard on iOS (status bar + header).
 * Test plan (iPhone TestFlight): Open DM → focus input → keyboard opens, input stays above it; last message visible; scroll down a bit to see space; drag list to dismiss keyboard. */
const KEYBOARD_AVOID_OFFSET = 88;

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const { user } = useAuth();
  const { refreshBadges } = useBadges();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [senderMetaByUserId, setSenderMetaByUserId] = useState<Record<string, SenderMeta>>({});
  const [loading, setLoading] = useState(true);
  const [messagesLoadError, setMessagesLoadError] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const listRef = useRef<FlatList>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const id = conversationId ?? '';

  const hydrateSenderProfiles = useCallback(async (rows: MessageRow[]) => {
    const ids = [...new Set(rows.map((m) => m.sender_id))];
    if (ids.length === 0) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('user_id, name, username, rep_level')
      .in('user_id', ids);
    if (error) return;
    const patch: Record<string, SenderMeta> = {};
    (data || []).forEach((p: { user_id: string; name: string | null; username: string | null; rep_level?: string | null }) => {
      patch[p.user_id] = {
        name: p.name,
        username: p.username,
        rep_level: normalizeCosignTierName(p.rep_level ?? null),
      };
    });
    setSenderMetaByUserId((prev) => ({ ...prev, ...patch }));
  }, []);

  const loadMessages = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMessagesLoadError(false);
    try {
      const list = await getMessages(id);
      setMessages(list);
      await hydrateSenderProfiles(list);
    } catch (e) {
      logger.error('DM chat: load messages failed', { err: e, screen: 'chat', conversationId: id });
      setMessagesLoadError(true);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id, hydrateSenderProfiles]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !user?.id) return;
      loadMessages();
      markConversationRead(id, user.id).then(() => refreshBadges()).catch(() => {});
      return () => {
        channelRef.current?.unsubscribe();
        channelRef.current = null;
      };
    }, [id, user?.id, loadMessages, refreshBadges])
  );

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`messages:${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const newRow = payload.new as MessageRow;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newRow.id)) return prev;
            return [...prev, newRow];
          });
          void hydrateSenderProfiles([newRow]);
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [id, hydrateSenderProfiles]);

  const handleSend = useCallback(async () => {
    const body = sanitizeText(input, SANITIZE_LIMITS.dmBody);
    if (!body || isOffensiveContent(body) || !user?.id || !id || sending) return;
    setInput('');
    const tempId = `temp-${Date.now()}`;
    const optimistic: MessageRow = {
      id: tempId,
      conversation_id: id,
      sender_id: user.id,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    void hydrateSenderProfiles([optimistic]);
    setSending(true);
    try {
      const sent = await sendMessage(id, user.id, body);
      hapticMedium();
      track('dm_sent', { thread_id: id });
      setMessages((prev) => {
        const replaced = prev.map((m) => (m.id === tempId ? sent : m));
        return replaced.filter((m, i) => replaced.findIndex((x) => x.id === m.id) === i);
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(body);
      logger.error('DM chat: send message failed', { err: e, screen: 'chat', conversationId: id });
    } finally {
      setSending(false);
    }
  }, [input, user?.id, id, sending, hydrateSenderProfiles]);

  const renderItem: ListRenderItem<MessageRow> = useCallback(
    ({ item }) => {
      const mine = item.sender_id === user?.id;
      const meta = senderMetaByUserId[item.sender_id];
      const label = mine
        ? 'You'
        : meta?.name?.trim() || meta?.username?.trim() || 'User';
      return (
        <MessageBubble
          message={item}
          isMine={mine}
          senderLabel={label}
          senderRepLevel={meta?.rep_level ?? null}
        />
      );
    },
    [user?.id, senderMetaByUserId]
  );

  if (!id) {
    return (
      <Screen>
        <Header title="Chat" showBack />
        <View style={styles.centered}>
          <Text style={[Typography.muted, { color: colors.textMuted }]}>
            Invalid conversation.
          </Text>
        </View>
      </Screen>
    );
  }

  const inputBarPaddingBottom = Spacing.sm + insets.bottom;
  const listPaddingBottom = INPUT_BAR_MIN_HEIGHT + inputBarPaddingBottom + LIST_PADDING_BOTTOM_EXTRA + keyboardHeight;

  return (
    <Screen style={styles.screen}>
      <Header title="Chat" showBack />
      <KeyboardAvoidingView
        style={[styles.kav, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={KEYBOARD_AVOID_OFFSET}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listPaddingBottom },
          ]}
          contentInsetAdjustmentBehavior="never"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            loading ? (
              <View style={styles.centered}>
                <Text style={[Typography.muted, { color: colors.textMuted }]}>
                  Loading…
                </Text>
              </View>
            ) : messagesLoadError ? (
              <View style={styles.centered}>
                <ErrorState onRetry={() => void loadMessages()} />
              </View>
            ) : (
              <View style={styles.centered}>
                <EmptyState
                  title="No messages yet"
                  subtitle="Say hi and get the conversation started."
                  icon="bubble.left.and.bubble.right.fill"
                />
              </View>
            )
          }
        />
        <View
          style={[
            styles.inputRow,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.border,
              paddingBottom: inputBarPaddingBottom,
            },
          ]}
        >
          <TextInput
            style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.text }]}
            placeholder="Type a message…"
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={SANITIZE_LIMITS.dmBody}
            editable={!sending}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            <IconSymbol name="paperplane.fill" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  kav: { flex: 1 },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: 0,
    paddingTop: Spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  bubbleWrap: {
    marginVertical: 2,
    maxWidth: '80%',
  },
  bubbleWrapLeft: { alignItems: 'flex-start' },
  bubbleWrapRight: { alignItems: 'flex-end' },
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    maxWidth: '100%',
  },
  senderName: {
    ...Typography.mutedSmall,
    fontWeight: '600',
    flexShrink: 1,
  },
  bubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 18,
    maxWidth: '100%',
  },
  bubbleText: {
    ...Typography.body,
  },
  bubbleTime: {
    ...Typography.mutedSmall,
    marginTop: 2,
    fontSize: 11,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: INPUT_BAR_MIN_HEIGHT,
    paddingHorizontal: 0,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 40,
    maxHeight: 100,
    ...Typography.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
});
