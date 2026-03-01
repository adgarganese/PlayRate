import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { supabase } from '@/lib/supabase';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

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
  } | null;
};

// Possibly unused: not imported anywhere.
type CourtChatPreviewProps = {
  courtId: string;
};

const PREVIEW_LIMIT = 3;

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getInitials(name: string | null, username: string | null): string {
  const displayName = name || username || 'A';
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return displayName[0].toUpperCase();
}

export function CourtChatPreview({ courtId }: CourtChatPreviewProps) {
  const { colors } = useThemeColors();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!courtId) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('court_chat_messages')
          .select('id, court_id, user_id, message, created_at')
          .eq('court_id', courtId)
          .order('created_at', { ascending: false })
          .limit(PREVIEW_LIMIT);

        if (error || cancelled) {
          if (!cancelled) setMessages([]);
          return;
        }

        const reversed = (data || []).reverse();
        const userIds = [...new Set(reversed.map((m) => m.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name, username, avatar_url')
          .in('user_id', userIds);

        const profilesMap = new Map(
          (profilesData || []).map((p) => [
            p.user_id,
            {
              name: p.name,
              username: p.username,
              avatar_url: p.avatar_url || null,
            },
          ])
        );

        const withProfiles: ChatMessage[] = reversed.map((msg) => ({
          ...msg,
          profile: profilesMap.get(msg.user_id) || null,
        }));

        if (!cancelled) setMessages(withProfiles);
      } catch (err) {
        if (__DEV__) console.warn('[CourtChatPreview:load]', err);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading chat...</Text>
      </View>
    );
  }

  if (messages.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>
        No messages yet. Be the first to chat!
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {messages.map((message) => {
        const displayName = message.profile?.name || message.profile?.username || 'Anonymous';
        const avatarUrl = message.profile?.avatar_url;
        const initials = getInitials(message.profile?.name || null, message.profile?.username || null);

        return (
          <View
            key={message.id}
            style={[styles.messageRow, { borderBottomColor: colors.border }]}
          >
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.avatarInitials, { color: colors.textMuted }]}>{initials}</Text>
                </View>
              )}
            </View>
            <View style={styles.bubble}>
              <Text style={[styles.author, { color: colors.text }]} numberOfLines={1}>
                {displayName}
              </Text>
              <Text style={[styles.messageText, { color: colors.text }]} numberOfLines={2}>
                {message.message}
              </Text>
              <Text style={[styles.time, { color: colors.textMuted }]}>
                {formatTime(message.created_at)}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    ...Typography.muted,
  },
  emptyText: {
    ...Typography.muted,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  list: {
    gap: 0,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  avatarWrap: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    ...Typography.mutedSmall,
    fontSize: 11,
    fontWeight: '600',
  },
  bubble: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    ...Typography.mutedSmall,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    ...Typography.body,
    fontSize: 14,
    lineHeight: 18,
  },
  time: {
    ...Typography.mutedSmall,
    fontSize: 11,
    marginTop: 2,
  },
});
