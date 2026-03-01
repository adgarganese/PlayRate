import { useEffect, useState, useCallback } from 'react';
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
  COURT_LINK_PREFIX,
  type MessageableUser,
} from '@/lib/dms';
import { getCourtPreview, type CourtPreview } from '@/lib/courts';

export default function SendCourtDmScreen() {
  const { courtId } = useLocalSearchParams<{ courtId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useThemeColors();
  const [court, setCourt] = useState<CourtPreview | null>(null);
  const [users, setUsers] = useState<MessageableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const id = courtId ?? '';

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
          getCourtPreview(id),
          getMessageableUsers(user.id),
        ]);
        if (!cancelled) {
          setCourt(preview ?? null);
          setUsers(list);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, id]);

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
      await sendMessage(conversationId, user.id, COURT_LINK_PREFIX + id);
      Alert.alert('Sent', 'Court sent.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (error) {
      if (__DEV__) console.warn('[courts-send-dm]', error);
      Alert.alert('Error', 'Could not send. Please try again.');
    } finally {
      setSending(false);
    }
  }, [user, id, selectedUserId, sending, router]);

  if (!user || !id) return null;

  return (
    <Screen>
      <Header title="Send via DM" showBack={false} />
      {loading && !court ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <>
          {/* Court preview */}
          {court && (
            <View style={[styles.previewCard, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
              <View style={styles.previewRow}>
                <View style={[styles.previewThumb, styles.previewThumbPlaceholder, { backgroundColor: colors.surface }]}>
                  <IconSymbol name="sportscourt.fill" size={24} color={colors.textMuted} />
                </View>
                <View style={styles.previewBody}>
                  <Text style={[styles.previewCreator, { color: colors.text }]} numberOfLines={1}>
                    {court.name}
                  </Text>
                  {court.address ? (
                    <Text style={[styles.previewCaption, { color: colors.textMuted }]} numberOfLines={2}>
                      {court.address}
                    </Text>
                  ) : null}
                  <Text style={[styles.previewSport, { color: colors.textMuted }]}>Court</Text>
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
          <View style={styles.footer}>
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
  previewThumb: { width: 56, height: 56, borderRadius: Radius.xs },
  previewThumbPlaceholder: { justifyContent: 'center', alignItems: 'center' },
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
  footer: { padding: Spacing.lg, paddingBottom: Spacing.xl },
  sendButton: {},
});
