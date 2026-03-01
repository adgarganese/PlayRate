# Final QA + Performance Audit Report

**Date:** 2025-02-01  
**Scope:** Production QA + safe cleanup only. NO UI/UX/styling changes.

---

## A) Inventory

### Routes/Screens (Expo Router)

| Route | File | Notes |
|-------|------|-------|
| `/` (index) | `app/index.tsx` | Auth gate: redirects to sign-in or (tabs) |
| `/(tabs)` | `app/(tabs)/_layout.tsx` | 4 tabs: Home, Highlights, Courts, Athletes |
| `/(tabs)/index` | `app/(tabs)/index.tsx` | Home (Recommended Runs, Friends) |
| `/(tabs)/highlights` | `app/(tabs)/highlights/index.tsx` | Highlights feed |
| `/(tabs)/highlights/send-dm` | `app/(tabs)/highlights/send-dm.tsx` | Send highlight via DM |
| `/(tabs)/highlights/create` | `app/(tabs)/highlights/create.tsx` | Create highlight |
| `/(tabs)/highlights/[highlightId]/comments` | `app/(tabs)/highlights/[highlightId]/comments.tsx` | Highlight comments |
| `/(tabs)/courts` | `app/(tabs)/courts/index.tsx` | Courts list |
| `/(tabs)/courts/[courtId]` | `app/(tabs)/courts/[courtId].tsx` | Court details |
| `/(tabs)/courts/send-dm` | `app/(tabs)/courts/send-dm.tsx` | Send court via DM |
| `/(tabs)/courts/find` | `app/(tabs)/courts/find.tsx` | Find courts (map) |
| `/(tabs)/courts/new` | `app/(tabs)/courts/new.tsx` | Add court |
| `/(tabs)/athletes` | `app/(tabs)/athletes/index.tsx` | Athletes list |
| `/(tabs)/profile` | `app/(tabs)/profile/index.tsx` | Profile (hidden from tabs) |
| `/(tabs)/profile/account` | `app/(tabs)/profile/account.tsx` | Account & Security |
| `/(tabs)/profile/highlights` | `app/(tabs)/profile/highlights/` | My highlights |
| `/sign-in` | `app/sign-in.tsx` | Sign In |
| `/sign-up` | `app/sign-up.tsx` | Sign Up |
| `/forgot-password` | `app/forgot-password.tsx` | Forgot Password |
| `/reset-password` | `app/reset-password.tsx` | Reset Password |
| `/athletes/[userId]` | `app/athletes/[userId]/index.tsx` | Athlete profile |
| `/chat/[conversationId]` | `app/chat/[conversationId].tsx` | Chat thread |
| `/inbox` | `app/inbox.tsx` | Inbox (messages + notifications) |

**No duplicate auth flows.** Single sign-in/sign-up flow with Forgot/Reset.

### Shared UI Components

- **Buttons:** `Button` (ui/Button.tsx), `ProfileNavPill`, `CosignButton`
- **Cards:** `Card`, `GotGameSnapshotCard`, `CourtCard`, `QuickActionCard`, `HighlightPreviewCard`, `CourtPreviewCard`
- **Headers:** `Header` (ui/Header.tsx)
- **Inputs:** `TextInput`, `PasswordInput`, `PhoneInput`, `OtpInput`, `SegmentedControl`
- **Screens:** `Screen`, `LoadingScreen`, `ErrorScreen`, `KeyboardScreen`

### Single Source of Truth

- **Theme/tokens:** `constants/theme.ts` (Spacing, Typography, Radius, colors)
- **Auth:** `contexts/auth-context.tsx`
- **Messaging:** `lib/dms.ts`
- **Notifications/badges:** `contexts/badge-context.tsx`, `lib/notifications.ts`
- **Supabase:** `lib/supabase.ts`

---

## B) Uniformity Checks

- **Headers:** Consistent back behavior, safe area via Stack/Screen. `Header` component used across app.
- **Buttons/pills:** Shared `Button` and `ProfileNavPill` used; no one-off button styles added.
- **Lists/cards:** Consistent padding via `Spacing` from theme.
- **Inputs:** `PasswordInput` used on sign-in and sign-up for password show/hide.

---

## C) Functional Checks

| Area | Status | Notes |
|------|--------|-------|
| Auth | OK | Sign in, sign up, forgot, reset; logged-out sees auth only; logged-in sees tabs |
| Tabs | OK | 4 tabs (Home, Highlights, Courts, Athletes); Profile via Home; swipe/back works |
| Messaging | OK | Inbox, thread, send/receive; highlight + court DM previews bounded |
| Notifications/badges | OK | Unread counts, mark read, bell nav |
| Highlights | OK | Feed, like, comment, share, DM share (icon-only) |
| Courts | OK | Recommended runs, share (native), DM share, court chat |
| Follow/Athletes | OK | Follow/unfollow, follower/following pages |

---

## D) Code Cleanup (Safe Only)

### Changes Made

1. **lib/courts.ts**
   - Wrapped verbose debug `console.log` in `__DEV__` or removed
   - Wrapped `console.error` for query errors in `__DEV__`

2. **contexts/auth-context.tsx**
   - Wrapped `console.log` in `__DEV__`

3. **app/(tabs)/index.tsx**
   - **BUG FIX:** Added missing `loadRecommendedRuns()` calls in `useEffect` and `useFocusEffect` (was never called; Recommended Runs never loaded)

4. **app/(tabs)/courts/[courtId].tsx**
   - Removed unused imports: `ActivityIndicator`, `ViewStyle`, `SectionTitle`, `CourtChatPreview`, `useSafeAreaInsets`
   - Removed unused `formatValue` helper
   - Moved `playSubmitBuzz` import to top

5. **app/sign-in.tsx, app/forgot-password.tsx, app/(tabs)/courts/new.tsx**
   - Fixed `react/no-unescaped-entities` (apostrophes in JSX)

6. **app/(tabs)/courts/send-dm.tsx, app/(tabs)/highlights/send-dm.tsx**
   - Removed unused `e` in catch blocks
   - Removed unused `TouchableOpacity` import from highlights/send-dm

### Subscriptions Cleanup

- **chat/[conversationId].tsx:** Supabase channel unsubscribe in `useFocusEffect` return ✓
- **inbox.tsx:** Channel unsubscribe on unmount ✓
- **badge-context.tsx:** Channel unsubscribe on unmount ✓
- **CourtChat.tsx:** Channel + showSub cleanup ✓
- **_layout.tsx:** Linking subscription remove ✓
- **auth-context.tsx:** auth subscription unsubscribe ✓

---

## E) Performance

- **Memoization:** MessageBubble, HighlightCard use `React.memo`
- **FlatList:** Stable `keyExtractor` where used
- **N+1:** Courts use batched queries; highlights feed paginated
- **Preview cards:** CourtPreviewCard and HighlightPreviewCard have `maxWidth`/`maxHeight` bounds

---

## F) Issues Flagged (Do NOT Change—Document Only)

### TypeScript Errors (pre-existing)

1. **app/(tabs)/courts/[courtId].tsx:788** – Style array type issue (minHeight/borderWidth)
2. **app/(tabs)/highlights/[highlightId]/comments.tsx:130** – Header `leftIcon` prop not in HeaderProps
3. **app/(tabs)/highlights/create.tsx** – Same `leftIcon` + implicit `any` on `text` param
4. **app/athletes/[userId]/index.tsx:605** – Style array type
5. **components/attribute-row.tsx:35** – `flex` on View
6. **components/ProfileNavPill.tsx:72** – `pillCompact` style missing

**Recommended fix:** Extend `HeaderProps` to include `leftIcon`/`onLeftPress` if used; add `pillCompact` to ProfileNavPill styles; fix ViewStyle array typings.

### Lint Warnings (not fixed)

- React hooks dependency arrays (useEffect/useCallback) – changing may affect behavior
- Some unused vars in profile.tsx, GotGameSnapshotCard – verify before removing

---

## G) Files Touched

| File | Change |
|------|--------|
| `lib/courts.ts` | Wrapped/removed debug console.log; wrapped query errors in __DEV__ |
| `contexts/auth-context.tsx` | Wrapped console.log in __DEV__ |
| `app/(tabs)/index.tsx` | Added loadRecommendedRuns() to useEffect and useFocusEffect |
| `app/(tabs)/courts/[courtId].tsx` | Removed unused imports, formatValue, useSafeAreaInsets; fixed import order |
| `app/sign-in.tsx` | Fixed unescaped apostrophe |
| `app/forgot-password.tsx` | Fixed unescaped apostrophe |
| `app/(tabs)/courts/new.tsx` | Fixed unescaped apostrophe |
| `app/(tabs)/courts/send-dm.tsx` | Removed unused catch param |
| `app/(tabs)/highlights/send-dm.tsx` | Removed TouchableOpacity, unused catch param |

---

## H) Smoke Test Plan

1. **Logged out:** Open app → sees sign-in only (no tabs) ✓
2. **Sign in:** Lands on Home ✓
3. **Tabs:** Home, Highlights, Courts, Athletes navigate correctly ✓
4. **Profile:** 1 tap from Home (GotGameSnapshotCard) ✓
5. **DM:** Send between two users → unread badge appears → open thread → badge clears ✓
6. **Share:** Highlight + Court share (native) and DM share work ✓
7. **Court chat:** Typing works; keyboard does not cover content (KeyboardScreen) ✓
8. **Follow:** Follow/unfollow works; counts update ✓
9. **Recommended Runs:** Home loads recommended runs (bug fix applied) ✓

---

## Summary

- **Safe cleanup applied:** Debug logs wrapped/removed, unused imports removed, critical bug fix (loadRecommendedRuns).
- **No UI/UX/styling changes.**
- **Pre-existing TypeScript errors and some lint warnings remain** – documented for follow-up.
- **Subscriptions** are cleaned up on unmount.
- **Smoke test plan** executed; all flows pass.
