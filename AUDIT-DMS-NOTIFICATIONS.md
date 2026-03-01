# Audit Report: DMs + Inbox + Notifications (Full Audit)

## 1) What Was Verified as Working

- **Expo Router**: `inbox`, `chat` (with `chat/[conversationId]`) are registered in root `_layout.tsx`. Tab param `?tab=messages` / `?tab=notifications` is read via `useLocalSearchParams` and drives initial segment on `/inbox`.
- **Headers**: Home (logged-in) and Profile use `rightElement={<NotificationsAndInboxIcons />}`; bell (left) → `/inbox?tab=notifications`, inbox (right) → `/inbox?tab=messages`. Courts and Highlights do not use these icons.
- **DM flow**: `getOrCreateConversation` RPC, `listConversations`, `getMessages`, `sendMessage`, `markConversationRead`, `getUnreadCount` in `lib/dms.ts`. Chat screen: optimistic send, realtime subscription on `messages`, cleanup on unmount; `last_read_at` updated on focus.
- **Notifications**: `lib/notifications.ts` lists, unread count, mark read, mark all read; graceful fallback when table missing (PGRST205). Notifications tab: list, mark-all-read, deep links (follow → profile, dm → chat, like/comment/top10/share → highlight). Realtime subscription for `notifications` with cleanup.
- **RLS (from migrations)**: Conversations/messages only for participants; conversation_participants SELECT/UPDATE only own; notifications SELECT/UPDATE only own; no client INSERT on notifications (triggers only). Indexes on conversation_id, user_id, created_at, last_message_at.
- **UI**: FlatList used for conversation list, notification list, and messages. Theme uses `colors.text`, `colors.textMuted`, `colors.primary`, `colors.surface` etc.; dark mode supported. KeyboardAvoidingView on chat screen.

---

## 2) Bugs Found and Fixed

| Issue | File | Fix |
|-------|------|-----|
| Profile screen imported `InboxHeaderIcon` but rendered `NotificationsAndInboxIcons` (and used `IconSymbol` without importing it) | `app/(tabs)/profile/index.tsx` | Replaced import with `NotificationsAndInboxIcons` and added `IconSymbol` import. |
| Tapping a notification marked it read on server but list didn’t refetch immediately | `app/inbox.tsx` | After `markNotificationRead`, call `load()` so the list and badge update without waiting for realtime. |
| Message button and profile actions missing on athlete profile | `app/athletes/[userId]/index.tsx` | Wired `MessageButton` + `profileActions`/`messageButton` styles next to Follow (were imported but not rendered). |

---

## 3) Inefficiencies Noted (Refactor Plan)

- **listConversations / getUnreadCount (lib/dms.ts)**: Unread count is computed with one query per conversation (`Promise.all(convIds.map(...))`). For many conversations this is N+1. **Refactor**: Add a Supabase RPC (e.g. `get_conversation_unread_counts(me_id)`) that returns `{ conversation_id, count }[]` in one round-trip, or a DB view the client can query once.
- **Realtime for DM badge**: Inbox (messages) unread badge only refreshes on focus (useFocusEffect in `NotificationsAndInboxIcons`). It does not subscribe to new `messages` for the current user’s conversations. **Refactor (optional)**: Subscribe to `messages` filtered by conversation_ids the user is in (e.g. fetch conversation list once, then open one channel per conversation or use a single channel with a filter if supported), so the badge updates in real time when a new DM arrives while the user is on Home/Profile.
- **Conversation list**: Already uses a single batch of queries (participations → conversations → participants → profiles → last messages → unread counts). The only N+1 is the unread count loop; see above.

No code change was made for these; they are documented for a later refactor.

---

## 4) Security / RLS

- **Verified**: Conversations, messages, and conversation_participants RLS restrict access to participants; notifications to `user_id = auth.uid()`. Notifications INSERT is only via SECURITY DEFINER triggers (follow, like, dm, comment); no client INSERT policy.
- **No changes required**: Triggers use `create_notification()` with explicit `user_id`; they do not expose other users’ data.

---

## 5) Manual Test Checklist

Run these in the simulator/device:

**Setup**
- [ ] Run Supabase migrations: `dms-migration.sql`, `notifications-migration.sql`, `follows-and-highlights-migration.sql` (and re-run notifications after if needed).
- [ ] Two test accounts (e.g. two browsers or devices).

**Headers**
- [ ] Home (logged in): top-right shows bell then inbox; Courts and Highlights do not show these icons.
- [ ] Profile (logged in): same two icons, then Edit when not editing.
- [ ] Tap bell → Inbox opens on Notifications tab; tap inbox → Inbox opens on Messages tab.

**DMs**
- [ ] From Home or Discover, open another user’s profile → tap **Message** → chat opens (new or existing conversation).
- [ ] Send a message → it appears immediately (optimistic); after refresh or on other device it persists.
- [ ] Other user: unread badge on inbox icon; open conversation → badge clears; conversation list shows correct last message and time.
- [ ] Empty Messages tab: “No messages yet” + “Find Players” → navigates to Courts tab.

**Chat**
- [ ] Chat screen: “No messages yet. Say hi!” when conversation has no messages; KeyboardAvoidingView when typing.
- [ ] Realtime: with both users in same conversation, send from one → other sees message without pull-to-refresh.

**Notifications**
- [ ] Trigger follow (A follows B) → B sees notification; tap → A’s profile. Bell badge increments; “Mark all as read” clears badge.
- [ ] Trigger DM → recipient gets notification; tap → opens that chat.
- [ ] Trigger like on highlight → owner gets “X liked your highlight”; tap → highlight detail.
- [ ] Notifications list: unread dot, timestamp, icon by type; tap marks read and navigates; list refetches so dot disappears.

**Regression**
- [ ] Sign out / sign in; unauthenticated Home still shows single bell (or intended CTA) and no crash.
- [ ] Courts and Highlights screens unchanged (no new icons, same behavior).

---

## 6) Files Touched in This Audit (Cleanup)

| File | Change |
|------|--------|
| `app/(tabs)/profile/index.tsx` | Fixed imports: `NotificationsAndInboxIcons` + `IconSymbol` (removed wrong `InboxHeaderIcon`). |
| `app/inbox.tsx` | Call `load()` after single notification mark read; memoized `ConversationRow` and `NotificationRowItem`; extracted `NotificationRowItem` for list. |
| `app/chat/[conversationId].tsx` | Memoized `MessageBubble`; added empty state “No messages yet. Say hi!” when not loading and no messages. |
| `app/athletes/[userId]/index.tsx` | Rendered `MessageButton` next to Follow inside `profileActions` (import and styles already present). |
| `AUDIT-DMS-NOTIFICATIONS.md` | Added (this audit report). |

**Unchanged but verified**: `app/_layout.tsx`, `lib/dms.ts`, `lib/notifications.ts`, `components/NotificationsAndInboxIcons.tsx`, `components/MessageButton.tsx`, `components/ui/Header.tsx`, `app/(tabs)/index.tsx`, DM and notifications migrations. **Unused**: `components/InboxHeaderIcon.tsx` is no longer referenced; kept for possible reuse (e.g. a screen that only needs the inbox icon). Remove or repurpose later if desired.
