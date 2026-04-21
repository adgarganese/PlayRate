import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  FlatList,
  Pressable,
  Platform,
  Keyboard,
  type ViewStyle,
  type ListRenderItemInfo,
} from 'react-native';
import { supabase } from '@/lib/supabase';
import { StorageAvatarImage } from '@/components/StorageAvatarImage';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography, Radius } from '@/constants/theme';
import { logger } from '@/lib/logger';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { isOffensiveContent, sanitizeText, SANITIZE_LIMITS } from '@/lib/sanitize';
import { normalizeCosignTierName } from '@/lib/tiers';
import { TierBadge } from '@/components/ui/TierBadge';

type ChatMessage = {
  id: string;
  court_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profile: {
    name: string | null;
    username: string | null;
    avatar_url: string | null;
    rep_level: string | null;
  } | null;
  opacity?: Animated.Value;
};

/** Bottom padding so last message is not hidden behind composer (height + buffer). Not keyboard-based. */
const COMPOSER_BOTTOM_PADDING = 92;
/** Fixed height for composer row so it never collapses (list gets remaining space). */
const COMPOSER_ROW_HEIGHT = 72;

type CourtChatProps = {
  courtId: string;
  messageLimit?: number;
  emptyMessage?: string;
  containerStyle?: ViewStyle;
  showHeader?: boolean;
  /** Use FlatList when inside parent ScrollView (e.g. court details); KAV wraps list+composer only */
  embeddedInScrollView?: boolean;
};

export function CourtChat({
  courtId,
  messageLimit = 50,
  emptyMessage = 'No messages yet. Be the first to chat!',
  containerStyle,
  showHeader = true,
  embeddedInScrollView = false,
}: CourtChatProps) {
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [myRepLevel, setMyRepLevel] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [messagesLoadFailed, setMessagesLoadFailed] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const lastSendTime = useRef<number>(0);
  const isAtBottomRef = useRef(true);
  const lastMessageCountRef = useRef(0);
  const COOLDOWN_MS = 2000;

  useEffect(() => {
    if (!user?.id) {
      setMyRepLevel(null);
      return;
    }
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('rep_level')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setMyRepLevel(normalizeCosignTierName(data?.rep_level ?? null));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Load initial messages and subscribe
  useEffect(() => {
    if (!courtId) return;

    // Reset state when court changes
    setMessages([]);
    setMessagesLoadFailed(false);
    setHasNewMessages(false);
    isAtBottomRef.current = true;
    setLoading(true);

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setup = async () => {
      await loadMessages();
      channel = subscribeToMessages();
    };

    setup();

    return () => {
      // Cleanup subscription when courtId changes or component unmounts
      if (channel) {
        channel.unsubscribe();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtId]);

  const loadMessages = async () => {
    if (!courtId) return;

    setLoading(true);
    setMessagesLoadFailed(false);
    try {
      // Fetch last 50 messages, ordered by created_at DESC, then reverse for display
      const { data, error } = await supabase
        .from('court_chat_messages')
        .select('id, court_id, user_id, message, created_at')
        .eq('court_id', courtId)
        .order('created_at', { ascending: false })
        .limit(messageLimit);

      if (error) {
        logger.error('Court chat: load messages failed', { err: error, courtId });
        setMessagesLoadFailed(true);
        setMessages([]);
        setLoading(false);
        return;
      }

      // Reverse to show oldest first (for scroll to bottom)
      const reversedMessages = (data || []).reverse();

      // Fetch profiles for all unique user_ids
      const userIds = [...new Set(reversedMessages.map(m => m.user_id))];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, name, username, avatar_url, rep_level')
        .in('user_id', userIds);

      const profilesMap = new Map(
        (profilesData || []).map((p) => [
          p.user_id,
          {
            name: p.name,
            username: p.username,
            avatar_url: p.avatar_url || null,
            rep_level: normalizeCosignTierName((p as { rep_level?: string | null }).rep_level),
          },
        ])
      );

      const messagesWithProfiles: ChatMessage[] = reversedMessages.map(msg => ({
        ...msg,
        profile: profilesMap.get(msg.user_id) || null,
        // Initial messages don't need animation
      }));

      setMessages(messagesWithProfiles);
      setMessagesLoadFailed(false);
      isAtBottomRef.current = true;
      lastMessageCountRef.current = messagesWithProfiles.length;
      setTimeout(() => {
        (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: false });
      }, 100);
    } catch (err) {
      logger.error('Court chat: load messages threw', { err, courtId });
      setMessagesLoadFailed(true);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!courtId) return null;

    const channel = supabase
      .channel(`court-chat:${courtId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'court_chat_messages',
          filter: `court_id=eq.${courtId}`,
        },
        async (payload) => {
          const newMessage = payload.new as ChatMessage;

          // Fetch profile for the new message
          const { data: profileData } = await supabase
            .from('profiles')
            .select('user_id, name, username, avatar_url, rep_level')
            .eq('user_id', newMessage.user_id)
            .single();

          const opacity = new Animated.Value(0);
          const messageWithProfile: ChatMessage = {
            ...newMessage,
            profile: profileData
              ? {
                  name: profileData.name,
                  username: profileData.username,
                  avatar_url: profileData.avatar_url || null,
                  rep_level: normalizeCosignTierName((profileData as { rep_level?: string | null }).rep_level),
                }
              : null,
            opacity,
          };

          setMessages(prev => {
            // Dedupe by id - check if message already exists
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            // Append new message to UI with animation
            Animated.timing(opacity, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start();
            return [...prev, messageWithProfile];
          });

          if (isAtBottomRef.current) {
            setTimeout(() => {
              (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true });
              setHasNewMessages(false);
            }, 50);
          } else {
            setHasNewMessages(true);
          }
        }
      )
      .subscribe();

    return channel;
  };

  const handleSendMessage = async () => {
    if (!user || !courtId) {
      return;
    }

    // Trim message and block empty
    const trimmedMessage = sanitizeText(messageText, SANITIZE_LIMITS.courtChatMessage);
    if (!trimmedMessage || isOffensiveContent(trimmedMessage)) {
      return;
    }

    // 2s cooldown between sends
    const now = Date.now();
    const timeSinceLastSend = now - lastSendTime.current;
    if (timeSinceLastSend < COOLDOWN_MS) return;

    // Optimistic UI: Add message immediately with animation
    const optimisticId = `temp-${Date.now()}`;
    const optimisticOpacity = new Animated.Value(0);
    const optimisticMessage: ChatMessage = {
      id: optimisticId,
      court_id: courtId,
      user_id: user.id,
      message: trimmedMessage,
      created_at: new Date().toISOString(),
      profile: {
        name: user.user_metadata?.name || null,
        username: user.user_metadata?.username || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        rep_level: myRepLevel,
      },
      opacity: optimisticOpacity,
    };

    setMessages(prev => {
      const newMessages = [...prev, optimisticMessage];
      // Animate in
      Animated.timing(optimisticOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      return newMessages;
    });
    setMessageText('');
    lastSendTime.current = now;
    setSending(true);

    setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 50);

    try {
      const { data, error } = await supabase
        .from('court_chat_messages')
        .insert({
          court_id: courtId,
          user_id: user.id,
          message: trimmedMessage,
        })
        .select('id, court_id, user_id, message, created_at')
        .single();

      if (error) {
        logger.error('Court chat: send message failed', { err: error, courtId });
        // Rollback: Remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setMessageText(trimmedMessage); // Restore message text
        lastSendTime.current = 0; // Reset cooldown on error so user can retry
        return;
      }

      if (!data) {
        // Rollback: Remove optimistic message
        setMessages(prev => prev.filter(m => m.id !== optimisticId));
        setMessageText(trimmedMessage); // Restore message text
        lastSendTime.current = 0; // Reset cooldown on error so user can retry
        return;
      }

      // Replace optimistic message with real one (realtime will also add it, but dedupe handles that)
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== optimisticId);
        // If realtime hasn't added it yet, add the real message
        if (!filtered.some(m => m.id === data.id)) {
          return [...filtered, {
            ...data,
            profile: optimisticMessage.profile, // Use cached profile
          }];
        }
        return filtered;
      });
      setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 150);
    } catch (err) {
      logger.error('Court chat: send message threw', { err, courtId });
      // Rollback: Remove optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      setMessageText(trimmedMessage); // Restore message text
      lastSendTime.current = 0; // Reset cooldown on error so user can retry
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    isAtBottomRef.current = true;
    setHasNewMessages(false);
    setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 100);
  }, [embeddedInScrollView]);

  // Scroll list to end when keyboard opens (so composer stays in view)
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 80)
    );
    return () => showSub.remove();
  }, [embeddedInScrollView]);

  const handleScroll = useCallback((event: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = COMPOSER_BOTTOM_PADDING + 20;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    isAtBottomRef.current = isNearBottom;
    if (isNearBottom) {
      setHasNewMessages(false);
    }
  }, []);

  const handleContentSizeChange = useCallback(() => {
    const count = messages.length;
    if (count > lastMessageCountRef.current || isAtBottomRef.current) {
      lastMessageCountRef.current = count;
      setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 50);
    }
  }, [messages.length, embeddedInScrollView]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffMs / 60000);
    if (diffSecs < 10) return 'now';
    if (diffMins < 1) return `${diffSecs}s`;
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getInitials = (name: string | null, username: string | null): string => {
    const displayName = name || username || 'A';
    const parts = displayName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return displayName[0].toUpperCase();
  };

  const renderMessageItem = useCallback(
    ({ item: message }: ListRenderItemInfo<ChatMessage>) => {
      const isOwnMessage = message.user_id === user?.id;
      const displayName = message.profile?.name || message.profile?.username || 'Anonymous';
      const avatarUrl = message.profile?.avatar_url;
      const initials = getInitials(message.profile?.name || null, message.profile?.username || null);

      const MessageContent = (
        <View style={styles.messageContent}>
          {!isOwnMessage && (
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <StorageAvatarImage
                  uriRaw={avatarUrl}
                  style={styles.avatar}
                  contentFit="cover"
                  accessibilityLabel={`${displayName} avatar`}
                  fallback={
                <View
                  style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}
                  accessible
                  accessibilityLabel={`${displayName}, initials ${initials}`}
                  accessibilityRole="image"
                >
                  <Text
                    style={[styles.avatarInitials, { color: colors.textOnPrimary }]}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    {initials}
                  </Text>
                </View>
                  }
                />
              ) : (
                <View
                  style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}
                  accessible
                  accessibilityLabel={`${displayName}, initials ${initials}`}
                  accessibilityRole="image"
                >
                  <Text
                    style={[styles.avatarInitials, { color: colors.textOnPrimary }]}
                    accessible={false}
                    importantForAccessibility="no"
                  >
                    {initials}
                  </Text>
                </View>
              )}
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isOwnMessage ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceAlt },
            ]}
          >
            <View style={styles.authorRow}>
              <Text
                style={[
                  styles.messageAuthor,
                  {
                    color: isOwnMessage ? colors.textOnPrimary : colors.text,
                    opacity: isOwnMessage ? 0.95 : 1,
                  },
                ]}
              >
                {isOwnMessage ? 'You' : displayName}
              </Text>
              <TierBadge
                tierName={isOwnMessage ? myRepLevel : message.profile?.rep_level}
                size="sm"
              />
            </View>
            <Text
              style={[
                styles.messageText,
                isOwnMessage ? { color: colors.textOnPrimary } : { color: colors.text },
              ]}
            >
              {message.message}
            </Text>
            <Text
              style={[
                styles.messageTime,
                isOwnMessage ? { color: colors.textOnPrimary, opacity: 0.7 } : { color: colors.textMuted, opacity: 0.6 },
              ]}
            >
              {formatTime(message.created_at)}
            </Text>
          </View>
        </View>
      );

      if (message.opacity) {
        return (
          <Animated.View
            style={[
              styles.messageRow,
              isOwnMessage && styles.ownMessageRow,
              { opacity: message.opacity },
            ]}
          >
            {MessageContent}
          </Animated.View>
        );
      }
      return (
        <View style={[styles.messageRow, isOwnMessage && styles.ownMessageRow]}>
          {MessageContent}
        </View>
      );
    },
    [user?.id, colors, myRepLevel]
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, containerStyle]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading chat...</Text>
        </View>
      </View>
    );
  }

  const listEmpty = messagesLoadFailed ? (
    <View style={styles.emptyContainer}>
      <ErrorState onRetry={() => void loadMessages()} />
    </View>
  ) : (
    <View style={styles.emptyContainer}>
      <EmptyState title={emptyMessage} subtitle="Say hi to others checked in at this court." icon="bubble.left.and.bubble.right.fill" />
    </View>
  );

  const composer = user ? (
    <>
      {errorMessage && (
        <View style={[styles.errorContainer, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.errorText, { color: colors.text }]}>{errorMessage}</Text>
        </View>
      )}
      <View style={[styles.inputContainer, { borderTopColor: colors.border }]}>
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              backgroundColor: colors.bg,
              borderColor: errorMessage ? colors.primary : colors.border,
              color: colors.text,
            },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={messageText}
          onChangeText={(text) => {
            setMessageText(text);
            if (errorMessage && text.trim()) setErrorMessage(null);
          }}
          onFocus={() => setTimeout(() => (embeddedInScrollView ? scrollViewRef.current : flatListRef.current)?.scrollToEnd({ animated: true }), 80)}
          multiline
          maxLength={SANITIZE_LIMITS.courtChatMessage}
          editable={!sending}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: messageText.trim() ? colors.primary : colors.border },
          ]}
          onPress={handleSendMessage}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.sendButtonText}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  ) : (
    <View style={[styles.signInPrompt, { borderTopColor: colors.border }]}>
      <Text style={[styles.signInText, { color: colors.textMuted }]}>Sign in to chat</Text>
    </View>
  );

  const messagesContentStyle = [
    styles.messagesContent,
    { paddingBottom: COMPOSER_BOTTOM_PADDING, flexGrow: 1 },
  ];

  const chatBody = (
    <View style={styles.chatBody}>
      <Pressable style={styles.messagesContainer} onPress={() => inputRef.current?.focus()}>
        {embeddedInScrollView ? (
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={messagesContentStyle}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
          >
            {messages.length === 0
              ? listEmpty
              : messages.map((message, index) => (
                  <View key={message.id}>
                    {renderMessageItem({
                      item: message,
                      index,
                      separators: { highlight: () => {}, unhighlight: () => {}, updateProps: () => {} },
                    })}
                  </View>
                ))}
          </ScrollView>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessageItem}
            keyExtractor={(item) => item.id}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={messagesContentStyle}
            onScroll={handleScroll}
            onContentSizeChange={handleContentSizeChange}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="always"
          />
        )}
      </Pressable>
      {hasNewMessages && (
        <View style={styles.newMessagesPillContainer}>
          <TouchableOpacity
            style={[styles.newMessagesPill, { backgroundColor: colors.primary }]}
            onPress={scrollToBottom}
          >
            <Text style={[styles.newMessagesPillText, { color: colors.textOnPrimary }]}>New messages ↓</Text>
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.composerRow}>
        {composer}
      </View>
    </View>
  );

  const bodyWrap = (
    <View style={styles.chatBodyWrap}>
      {chatBody}
    </View>
  );

  const bodyWithKav = embeddedInScrollView ? bodyWrap : (
    <KeyboardAvoidingView
      style={styles.chatBodyWrap}
      behavior={Platform.OS === 'ios' ? 'position' : 'height'}
      keyboardVerticalOffset={0}
    >
      {chatBody}
    </KeyboardAvoidingView>
  );

  const containerHeight = embeddedInScrollView ? { height: 480 } : undefined;

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, containerHeight, containerStyle]}>
      {showHeader && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.headerText, { color: colors.text }]}>Live Chat</Text>
        </View>
      )}
      {bodyWithKav}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 400,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  chatBodyWrap: {
    flex: 1,
    minHeight: 0,
  },
  chatBody: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 320,
  },
  composerRow: {
    height: COMPOSER_ROW_HEIGHT,
    minHeight: COMPOSER_ROW_HEIGHT,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerText: {
    ...Typography.bodyBold,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    ...Typography.muted,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  emptyText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  ownMessageRow: {
    justifyContent: 'flex-end',
  },
  messageContent: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    maxWidth: '85%',
    gap: Spacing.xs,
  },
  avatarContainer: {
    marginBottom: 2,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  avatarPlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    ...Typography.mutedSmall,
    fontSize: 10,
    fontWeight: '600',
  },
  messageBubble: {
    maxWidth: '100%',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  messageAuthor: {
    ...Typography.mutedSmall,
    fontSize: 12,
    marginBottom: 0,
    fontWeight: '600',
    flexShrink: 1,
  },
  messageText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 18,
  },
  messageTime: {
    ...Typography.mutedSmall,
    fontSize: 9,
    marginTop: 2,
  },
  newMessagesPillContainer: {
    position: 'absolute',
    top: Spacing.md,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
    zIndex: 10,
  },
  newMessagesPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  newMessagesPillText: {
    ...Typography.mutedSmall,
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    ...Typography.body,
    borderWidth: 1,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
  },
  sendButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  sendButtonText: {
    ...Typography.bodyBold,
    fontSize: 14,
  },
  signInPrompt: {
    padding: Spacing.md,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  signInText: {
    ...Typography.muted,
  },
  errorContainer: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  errorText: {
    ...Typography.mutedSmall,
    fontSize: 12,
  },
});
