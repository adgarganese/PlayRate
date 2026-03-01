import React, { useCallback, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { supabase } from '@/lib/supabase';
import { Screen } from '@/components/ui/Screen';
import { Header } from '@/components/ui/Header';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { ProfilePicture } from '@/components/ProfilePicture';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { listConversations, type ConversationWithMeta } from '@/lib/dms';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from '@/lib/notifications';
import { Spacing, Typography, Radius } from '@/constants/theme';

type Tab = 'messages' | 'notifications';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'Now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const ConversationRow = React.memo(function ConversationRow({
  item,
  onPress,
}: {
  item: ConversationWithMeta;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  const displayName = item.other_user_name || item.other_user_username || 'Unknown';
  const snippet = item.last_message_body
    ? (item.last_message_body.length > 40 ? item.last_message_body.slice(0, 40) + '…' : item.last_message_body)
    : 'No messages yet';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.convRow,
        { backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <ProfilePicture avatarUrl={item.other_user_avatar_url} size={48} editable={false} />
      <View style={styles.convBody}>
        <View style={styles.convRowTop}>
          <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={[styles.convTime, { color: colors.textMuted }]}>
            {formatTime(item.last_message_at ?? item.last_message_created_at)}
          </Text>
        </View>
        <View style={styles.convRowBottom}>
          <Text style={[styles.convSnippet, { color: colors.textMuted }]} numberOfLines={1}>
            {snippet}
          </Text>
          {item.unread_count > 0 && (
            <View style={[styles.unreadDot, { backgroundColor: colors.primary }]}>
              <Text style={styles.unreadText}>
                {item.unread_count > 99 ? '99+' : item.unread_count}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
});

function MessagesTab() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setConversations([]);
      setLoading(false);
      return;
    }
    try {
      const list = await listConversations(user.id);
      const deduped = list.filter((c, i) => list.findIndex((x) => x.id === c.id) === i);
      setConversations(deduped);
    } catch (e) {
      if (__DEV__) console.error('List conversations:', e);
      setConversations([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
      return () => {
        channelRef.current?.unsubscribe();
        channelRef.current = null;
      };
    }, [load])
  );

  // Realtime: when any new message is inserted, refetch inbox so recipient sees new/conversations
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel('inbox-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => {
          load();
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  if (!user) {
    return (
      <View style={styles.tabContent}>
        <Card>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sign in to see messages.
          </Text>
        </Card>
      </View>
    );
  }

  if (loading && conversations.length === 0) {
    return (
      <View style={[styles.tabContent, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (conversations.length === 0) {
    return (
      <View style={[styles.tabContent, styles.centered]}>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No messages yet</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
          Find players and start a conversation.
        </Text>
        <Button
          title="Find Players"
          onPress={() => router.push('/profiles')}
          variant="primary"
          style={styles.emptyCta}
        />
      </View>
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
      renderItem={({ item }) => (
        <ConversationRow
          item={item}
          onPress={() => router.push(`/chat/${item.id}`)}
        />
      )}
    />
  );
}

function notificationIconName(type: string): string {
  switch (type) {
    case 'follow': return 'person.badge.plus.fill';
    case 'like': return 'star.fill';
    case 'comment': return 'message.fill';
    case 'dm': return 'message.fill';
    case 'top10': return 'medal.fill';
    case 'share': return 'square.and.arrow.up';
    default: return 'bell.fill';
  }
}

const NotificationRowItem = React.memo(function NotificationRowItem({
  item,
  onPress,
}: {
  item: NotificationRow;
  onPress: () => void;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.notifRow,
        { backgroundColor: colors.surface },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.notifIconWrap, { backgroundColor: colors.surfaceAlt }]}>
        <IconSymbol name={notificationIconName(item.type) as React.ComponentProps<typeof IconSymbol>['name']} size={20} color={colors.primary} />
      </View>
      <View style={styles.notifBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
          {!item.read_at && (
            <View style={[styles.unreadDotSmall, { backgroundColor: colors.primary }]} />
          )}
        </View>
        {item.body ? (
          <Text style={[styles.notifBodyText, { color: colors.textMuted }]} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        <Text style={[styles.notifTime, { color: colors.textMuted }]}>
          {formatTime(item.created_at)}
        </Text>
      </View>
    </Pressable>
  );
});

function NotificationsTab() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const [list, setList] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) {
      setList([]);
      setLoading(false);
      return;
    }
    try {
      const data = await listNotifications(user.id);
      const arr = data || [];
      const deduped = arr.filter((n, i) => arr.findIndex((x) => x.id === n.id) === i);
      setList(deduped);
    } catch (e) {
      if (__DEV__) console.error('List notifications:', e);
      setList([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
      return () => {
        channelRef.current?.unsubscribe();
        channelRef.current = null;
      };
    }, [load])
  );

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { load(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => { load(); }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [user?.id, load]);

  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id || markingAll) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(user.id);
      await load();
    } finally {
      setMarkingAll(false);
    }
  }, [user?.id, load, markingAll]);

  const handlePress = useCallback(
    async (n: NotificationRow) => {
      if (!user?.id) return;
      if (!n.read_at) {
        await markNotificationRead(n.id, user.id);
        load();
      }
      if (n.type === 'follow' && n.actor_id) {
        router.push(`/athletes/${n.actor_id}/profile` as any);
        return;
      }
      if (n.type === 'dm' && n.entity_id) {
        router.push(`/chat/${n.entity_id}`);
        return;
      }
      if (['like', 'comment', 'top10', 'share'].includes(n.type) && n.entity_id) {
        router.push(`/(tabs)/profile/highlights/${n.entity_id}` as any);
      }
    },
    [user?.id, router, load]
  );

  if (!user) {
    return (
      <View style={styles.tabContent}>
        <Card>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Sign in to see notifications.
          </Text>
        </Card>
      </View>
    );
  }

  if (loading && list.length === 0) {
    return (
      <View style={[styles.tabContent, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const unreadCount = list.filter((n) => !n.read_at).length;

  return (
    <View style={styles.tabContent}>
      {unreadCount > 0 && (
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={markingAll}
          style={[styles.markAllRow, { borderBottomColor: colors.border }]}
        >
          <Text style={[styles.markAllText, { color: colors.primary }]}>
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </Text>
        </TouchableOpacity>
      )}
      {list.length === 0 ? (
        <View style={[styles.centered, { flex: 1 }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet.</Text>
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          renderItem={({ item }) => (
            <NotificationRowItem item={item} onPress={() => handlePress(item)} />
          )}
        />
      )}
    </View>
  );
}

export default function InboxScreen() {
  const { colors } = useThemeColors();
  const params = useLocalSearchParams<{ tab?: string }>();
  const tabParam = params.tab === 'notifications' ? 'notifications' : 'messages';
  const [tab, setTab] = useState<Tab>(tabParam);

  useEffect(() => {
    setTab(tabParam);
  }, [tabParam]);

  return (
    <Screen>
      <Header title="Inbox" showBack={false} />
      <View style={[styles.segmented, { backgroundColor: colors.surfaceAlt }]}>
        <Pressable
          style={[
            styles.segmentedButton,
            tab === 'messages' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setTab('messages')}
        >
          <Text
            style={[
              styles.segmentedText,
              { color: tab === 'messages' ? colors.textOnPrimary : colors.textMuted },
            ]}
          >
            Messages
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.segmentedButton,
            tab === 'notifications' && { backgroundColor: colors.primary },
          ]}
          onPress={() => setTab('notifications')}
        >
          <Text
            style={[
              styles.segmentedText,
              { color: tab === 'notifications' ? colors.textOnPrimary : colors.textMuted },
            ]}
          >
            Notifications
          </Text>
        </Pressable>
      </View>
      {tab === 'messages' ? <MessagesTab /> : <NotificationsTab />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    borderRadius: Radius.sm,
  },
  segmentedText: {
    ...Typography.bodyBold,
  },
  tabContent: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  listContent: {
    paddingBottom: Spacing.xl,
  },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: 1,
    borderRadius: Radius.sm,
  },
  pressed: {
    opacity: 0.8,
  },
  convBody: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  convRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  convName: {
    ...Typography.bodyBold,
    flex: 1,
  },
  convTime: {
    ...Typography.mutedSmall,
  },
  convRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  convSnippet: {
    ...Typography.muted,
    flex: 1,
  },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    ...Typography.mutedSmall,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...Typography.muted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  emptyText: {
    ...Typography.muted,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: Spacing.sm,
  },
  markAllRow: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    alignItems: 'flex-end',
  },
  markAllText: {
    ...Typography.bodyBold,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginBottom: 1,
    borderRadius: Radius.sm,
  },
  notifIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  notifBody: {
    flex: 1,
  },
  notifTitle: {
    ...Typography.bodyBold,
    marginBottom: 2,
  },
  notifBodyText: {
    ...Typography.mutedSmall,
    marginBottom: 2,
  },
  notifTime: {
    ...Typography.mutedSmall,
    fontSize: 11,
  },
  unreadDotSmall: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.sm,
  },
});
