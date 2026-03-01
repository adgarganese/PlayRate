# Dead Code Audit Report

## 1. Expo Router routes – reachability

| Route | Reachable from | Notes |
|-------|----------------|-------|
| `(tabs)` | index redirect, sign-in/sign-up replace | Main app |
| `(tabs)/index` | Tab bar (Home) | ✓ |
| `(tabs)/highlights/*` | Tab, router.push from home/profile/inbox | ✓ |
| `(tabs)/courts/*` | Tab, router.push from home/find/new | ✓ |
| `(tabs)/athletes/index` | Tab (Athletes) | ✓ |
| `(tabs)/profile/*` | Tab (href: null but reachable), router.push from home | ✓ |
| `(tabs)/explore` | Tab (href: null – hidden) | Expo template; keep |
| `sign-in`, `sign-up` | Redirect, router.replace | ✓ |
| `forgot-password`, `reset-password` | Sign-in link, _layout deep link | ✓ |
| `my-sports`, `self-ratings` | profile.tsx, (tabs)/profile | ✓ |
| `profiles` | index (Find Athletes), inbox | ✓ |
| `profile` | Stack screen; reached via tab profile flow | ✓ |
| `athletes/[userId]/*` | Multiple router.push from home, inbox, comments, etc. | ✓ |
| `inbox` | NotificationsAndInboxIcons (bell) | ✓ |
| `chat/[conversationId]` | inbox, MessageButton | ✓ |
| `runs/[id]/recap` | Deep link / future; no in-app router.push found | Possibly unused – not deleted (deep link target) |
| `test-connection` | connection-test.tsx, __DEV__ only | ✓ |
| `modal` | Stack.Screen only; no router.push in app | Possibly unused (Expo template placeholder) |

## 2. Suspected orphan components (not imported anywhere)

- **CourtComments** (`components/CourtComments.tsx`) – Not imported. `fetchCourtComments` in `lib/courts-api.ts` is also never used. **Possibly unused** – left in place with comment.
- **CourtChatPreview** (`components/CourtChatPreview.tsx`) – Not imported. **Possibly unused** – left in place with comment.
- **YourSnapshotCard** (`components/YourSnapshotCard.tsx`) – Not imported in app. **Possibly unused** – left in place with comment.
- **QuickActionCard** (`components/QuickActionCard.tsx`) – Not imported in app. **Possibly unused** – left in place with comment.
- **GotGameLogo**, **AppIcon** – Exported from `components/brand/index.ts` but never imported in app. **Possibly unused** – left in place (branding).

## 3. Suspected orphan lib/hooks

- **fetchCourtComments** (`lib/courts-api.ts`) – Not imported anywhere. Paired with CourtComments. **Possibly unused** – not removed.
- All hooks in `hooks/` are used: `useFollow`, `use-resend-timer`, `use-color-scheme`, `use-theme-color`; `use-color-scheme.web.ts` is platform-specific (web).

## 4. Assets

- `assets/branding/skormor-logo.png` – Used in GotGameLogoText.
- `assets/images/react-logo.png` – Used in explore.tsx.
- `assets/fonts/*` – Referenced in lib/fonts.ts and _layout (commented). Not deleted.

## 5. Confirmed safe deletes

- **None.** No files or routes were deleted. Only “Possibly unused” comments and this report were added. Unused imports/vars were removed only where obvious and verified.

## 6. Refactors applied (Phase 1)

- No unused imports or variables were removed (codebase had no obvious unused-import/variable violations in audited files).
- Added “Possibly unused” comments to: CourtComments, CourtChatPreview, YourSnapshotCard, QuickActionCard, app/modal.tsx, and fetchCourtComments in lib/courts-api.ts.

## 7. Summary

- **Deleted:** No files or routes.
- **Possibly unused (do not delete):** modal route, runs/recap in-app nav, CourtComments, CourtChatPreview, YourSnapshotCard, QuickActionCard, GotGameLogo, AppIcon, fetchCourtComments.
- **Migrations:** Not touched (per instructions).
- **Checks:** TypeScript `tsc --noEmit` reports one pre-existing error in `components/haptic-tab.tsx` (ref type compatibility); not introduced by this audit.
