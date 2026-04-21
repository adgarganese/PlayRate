# Deep links and universal links

This document describes how inbound links are handled, what share URLs the app generates, and what you need for HTTPS universal links in production.

## Custom scheme (`playrate://`)

- **Expo config:** `app.json` sets `"scheme": "playrate"` (see `expo.scheme`). That registers the native URL scheme so `playrate://…` opens the app.
- **Handler:** `app/_layout.tsx` subscribes to `Linking.addEventListener('url', …)` and `Linking.getInitialURL()` (cold start). Auth and password-reset URLs are handled first; then **app content** links are resolved with `lib/deep-links.ts` (`isInboundAppContentLink`, `resolveAppPathFromInboundLink`).
- **Expo Router:** The app does **not** rely on Expo Router alone to map arbitrary URLs to screens. File-based routes exist (e.g. `app/(tabs)/highlights/[highlightId]/index.tsx` → `/highlights/:highlightId`), but the **root custom handler** normalizes both `playrate://` and allowed `https://` hosts and calls `router.replace` / `router.push` so behavior is explicit and matches legacy path shapes.

## Universal links (`https://`)

### When they work

- **iOS:** `associatedDomains` is set in **generated** config only when `EXPO_PUBLIC_UNIVERSAL_LINK_HOST` is set at build time (see `app.config.js`). Value must be the **hostname only** (e.g. `app.playrate.com`).
- **Android:** An `intentFilters` entry with `scheme: https`, `host: <that hostname>`, `pathPrefix: /`, and `autoVerify: true` is added the same way.
- **Runtime:** `lib/deep-links.ts` treats **`https://playrate.app/...`** and **`https://www.playrate.app/...`** as trusted **without** env (for marketing links). **`EXPO_PUBLIC_UNIVERSAL_LINK_HOST`** adds one more exact hostname match (normalized, no `https://` in the env value).

### What you must host (not in this repo)

For the chosen hostname(s):

1. **Apple:** `https://<host>/.well-known/apple-app-site-association` (or root AASA per Apple rules), listing paths you want to open the app (e.g. `/highlights/*`, `/courts/*`, …).
2. **Android:** `https://<host>/.well-known/assetlinks.json` with your signing cert + package `com.playrate.app`.

Until those files exist, **custom scheme links remain the reliable beta path** (`playrate://…`).

### `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`

| | |
|--|--|
| **Purpose** | Build-time hostname for `associatedDomains` / Android App Links + runtime allowlist in `lib/deep-links.ts`. |
| **Format** | Hostname only: `app.playrate.com` (no `https://`, no path). |
| **Where set** | EAS env / `.env` for local dev; also mirrored in `app.json` → `extra.universalLinkHost` for substitution. |
| **Supabase auth** | If you use HTTPS for auth callback, use `https://<same-host>/auth/callback` in Supabase redirect URLs and handle it in-app (see `lib/parse-auth-url.ts`, `app/auth/callback.tsx`). |

## Supported inbound path patterns

All of the following resolve after optional leading slash. Query strings and fragments on the path are ignored for routing (IDs are taken from the path segment).

| Pattern | Opens (Expo path) | Custom scheme | HTTPS (trusted hosts) |
|--------|-------------------|---------------|------------------------|
| `highlights/{id}` | `/highlights/{id}` | Yes | Yes |
| `profile/highlights/{id}` (legacy) | `/highlights/{id}` | Yes | Yes |
| `courts/{courtId}` | `/courts/{courtId}` | Yes | Yes |
| `courts/run/{runId}` | `/courts/run/{runId}` | Yes | Yes |
| `runs/{runId}` | `/courts/run/{runId}` | Yes | Yes |
| `athletes/{userId}` | `/athletes/{userId}` | Yes | Yes |
| `athletes/{userId}/profile` | `/athletes/{userId}/profile` | Yes | Yes |
| `chat/{conversationId}` | `/chat/{conversationId}` | Yes | Yes |

**Unknown paths** under `playrate://` or under an allowed HTTPS host navigate to **Home** (`/(tabs)`).

**Not handled here:** `playrate://auth/callback`, password recovery, `playrate://reset-password` — those are handled earlier in `app/_layout.tsx` (including recovery tokens in the URL hash). For **email** password reset, prefer an **HTTPS** `redirectTo` (see `lib/password-reset-redirect.ts` and `web/password-reset-bridge.html` in `PASSWORD-RESET-SETUP.md`) because many mail clients block custom schemes.

## Where share links are generated

| Location | URL format |
|----------|------------|
| `app/(tabs)/highlights/[highlightId]/index.tsx` — share | `playrateHighlightUrl(id)` → `playrate://highlights/{id}` |
| `app/(tabs)/highlights/index.tsx` — share | Same |
| `app/(tabs)/courts/[courtId].tsx` — share | `playrateCourtUrl(id)` → `playrate://courts/{id}` |
| `app/(tabs)/highlights/send-dm.tsx` | `HIGHLIGHT_LINK_PREFIX` + id (`lib/dms.ts`) → `playrate://highlights/` |
| `app/(tabs)/courts/send-dm.tsx` | `COURT_LINK_PREFIX` + id (`lib/dms.ts`) → `playrate://courts/` |

DM bodies still parse **legacy** `playrate://profile/highlights/{id}` in `parseHighlightIdFromBody` so older messages keep working.

## Push notifications

`lib/push-notifications.ts` navigates with **Expo paths** (`/highlights/...`, `/courts/run/...`, etc.), not share URLs. No change required for deep link consistency.

## Beta limitations

- **Universal links** require a live domain with AASA + assetlinks and a native rebuild after setting `EXPO_PUBLIC_UNIVERSAL_LINK_HOST`.
- **HTTPS** deep opens only work for hostnames allowlisted in `lib/deep-links.ts` (see above).
- Recipients **must have the app installed** for `playrate://` links; the OS opens the app if registered.
- **Web-only** recipients clicking `https://playrate.app/...` need a **web** experience on that path unless universal links hand off to the app.

## Quick manual tests

1. Share a highlight from the app; open the copied `playrate://highlights/…` link on a device with the app → detail screen.
2. Share a court; open `playrate://courts/…` → court screen.
3. (After AASA) Open `https://playrate.app/highlights/<id>` from Mail/Notes → same screen.
