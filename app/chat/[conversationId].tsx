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
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HighlightPreviewCard } from '@/components/HighlightPreviewCard';
import { CourtPreviewCard } from '@/components/CourtPreviewCard';
import { devError } from '@/lib/logging';

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

const MessageBubble = React.memo(function MessageBubble({
  message,
  isMine,
}: {
  message: MessageRow;
  isMine: boolean;
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
  const [loading, setLoading] = useState(true);
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

  const loadMessages = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const list = await getMessages(id);
      setMessages(list);
    } catch (e) {
      devError('Chat', 'Load messages:', e);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

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
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [id]);

  const handleSend = useCallback(async () => {
    const body = input.trim();
    if (!body || !user?.id || !id || sending) return;
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
    setSending(true);
    try {
      const sent = await sendMessage(id, user.id, body);
      track('dm_sent', { thread_id: id });
      setMessages((prev) => {
        const replaced = prev.map((m) => (m.id === tempId ? sent : m));
        return replaced.filter((m, i) => replaced.findIndex((x) => x.id === m.id) === i);
      });
    } catch (e) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(body);
      if (__DEV__) console.error('Send message:', e);
    } finally {
      setSending(false);
    }
  }, [input, user?.id, id, sending]);

  const renderItem: ListRenderItem<MessageRow> = useCallback(
    ({ item }) => (
      <MessageBubble message={item} isMine={item.sender_id === user?.id} />
    ),
    [user?.id]
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
            ) : (
              <View style={styles.centered}>
                <Text style={[Typography.muted, { color: colors.textMuted }]}>
                  No messages yet. Say hi!
                </Text>
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
            maxLength={2000}
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
