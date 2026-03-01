# Court Chat Implementation Summary

## Files Changed

### 1. SQL Migration
**File:** `create-court-chat-messages.sql`
- Creates `court_chat_messages` table with columns: `id`, `court_id`, `user_id`, `message`, `created_at`
- Creates indexes for efficient queries:
  - `idx_court_chat_messages_court_id` - for filtering by court
  - `idx_court_chat_messages_court_id_created_at` - composite index for ordered queries
  - `idx_court_chat_messages_user_id` - for user lookups
- Enables RLS (Row Level Security)
- Creates RLS policies:
  - SELECT: Authenticated users can read all messages
  - INSERT: Authenticated users can only insert messages with their own `user_id`

### 2. CourtChat Component
**File:** `components/CourtChat.tsx`
- New component that implements Twitch-style live chat
- Features:
  - Loads last 50 messages on mount (ordered by `created_at` DESC, then reversed for display)
  - Subscribes to realtime inserts via Supabase Realtime
  - Auto-scrolls to bottom when user is at bottom
  - Shows "New messages" button when user has scrolled up
  - Displays username/display name + relative timestamp
  - Message bubbles styled differently for own messages vs others
  - Sign-in prompt for unauthenticated users
- Uses theme tokens (no hardcoded colors):
  - `colors.surface`, `colors.border`, `colors.text`, `colors.textMuted`
  - `colors.primary` for own messages and buttons
  - `colors.surfaceAlt` for other users' messages
  - `colors.bg` for input background

### 3. Court Detail Screen
**File:** `app/courts/[courtId].tsx`
- Added import for `CourtChat` component
- Embedded `<CourtChat courtId={courtId} />` below the court header card
- Added `chatSection` style for proper spacing

## How to Test

### 1. Database Setup
1. Run the SQL migration in your Supabase SQL editor:
   ```sql
   -- Copy and paste contents of create-court-chat-messages.sql
   ```
2. Verify the table was created:
   ```sql
   SELECT * FROM court_chat_messages LIMIT 1;
   ```
3. Verify RLS policies are active:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'court_chat_messages';
   ```

### 2. Frontend Testing

#### Test 1: Basic Chat Functionality
1. Navigate to any court detail page (e.g., `/courts/[some-court-id]`)
2. Scroll down to see the "Live Chat" section
3. If not signed in, you should see "Sign in to join the chat"
4. Sign in and verify the chat input appears
5. Type a message and click "Send"
6. Verify your message appears in the chat with your username/name
7. Verify the message shows a relative timestamp (e.g., "now", "2m", "1h")

#### Test 2: Realtime Updates
1. Open the same court detail page in two different browser tabs/windows (or two devices)
2. Sign in with different accounts in each
3. Send a message from Tab 1
4. Verify the message appears in Tab 2 automatically (without refresh)
5. Send a message from Tab 2
6. Verify it appears in Tab 1 automatically

#### Test 3: Auto-scroll Behavior
1. Send several messages to populate the chat
2. Verify the chat auto-scrolls to the bottom when new messages arrive
3. Scroll up in the chat
4. Send a new message from another tab/device
5. Verify a "New messages ↓" button appears
6. Click the button and verify it scrolls to bottom

#### Test 4: Message History
1. Send more than 50 messages to a court
2. Refresh the page
3. Verify only the last 50 messages are loaded
4. Verify messages are displayed in chronological order (oldest first)

#### Test 5: Theme Colors
1. Verify all colors use theme tokens (check in both light and dark mode if available)
2. Verify own messages have primary color background
3. Verify other users' messages have surfaceAlt background
4. Verify text colors adapt to theme

#### Test 6: Edge Cases
1. Test with empty chat (no messages yet)
2. Test with very long messages (should wrap properly)
3. Test with special characters/emojis
4. Test message character limit (500 characters)
5. Test sending messages while offline (should handle gracefully)

### 3. Security Testing
1. Try to insert a message with a different `user_id` (should fail due to RLS)
2. Verify unauthenticated users cannot send messages
3. Verify authenticated users can read all messages
4. Verify messages are properly filtered by `court_id`

## Notes

- The chat component is fixed height (400px) to prevent it from taking up too much screen space
- Messages are limited to 500 characters
- The component automatically loads the last 50 messages to balance performance and history
- Realtime subscription is properly cleaned up on component unmount
- The component handles profile loading for all messages (both initial load and new messages)
