# Sentry setup for PlayRate

## Already done

- **@sentry/react-native** installed and used in `lib/sentry.ts`
- **SENTRY_AUTH_TOKEN** stored as EAS secret (production + preview) for source map uploads
- App layout initializes Sentry when DSN is set; user and route context are set
- Build uploads source maps during EAS build (token used automatically)

---

## What you still need to do

### 1. Get values from Sentry

In [sentry.io](https://sentry.io) → your org → your project:

- **Org slug**: URL is `https://sentry.io/organizations/<org-slug>/` or in **Settings → General**
- **Project slug**: URL is `.../projects/<org-slug>/<project-slug>/` or in **Project Settings**
- **DSN**: **Project Settings → Client Keys (DSN)** — copy the DSN (starts with `https://...@sentry.io/...`)

### 2. Set org and project in the repo

The repo is set to **org** `playrate` and **project** `playrate` in **app.json** and **ios/sentry.properties**. If your Sentry org or project use different slugs, replace them in both places:

- **app.json** — in the `@sentry/react-native/expo` plugin: `organization`, `project`
- **ios/sentry.properties** — `defaults.org`, `defaults.project`

Use the same org/project in both so uploads and events match.

### 3. Set DSN in EAS so the app sends events

Without a DSN, the app won’t send errors to Sentry. Set it per environment:

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/PROJECT_ID" --type string --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://YOUR_KEY@YOUR_ORG.ingest.sentry.io/PROJECT_ID" --type string --environment preview --visibility plaintext
```

Use your real DSN from step 1. Optionally set environment label:

```bash
eas env:create --name EXPO_PUBLIC_SENTRY_ENVIRONMENT --value "production" --type string --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SENTRY_ENVIRONMENT --value "preview" --type string --environment preview --visibility plaintext
```

### 4. Optional

- **Android**: If you add an Android build, add `android/sentry.properties` with the same `defaults.org` and `defaults.project` (and keep using `SENTRY_AUTH_TOKEN` in EAS).
- **Alerts**: In Sentry, configure **Alerts** for new issues or spike in errors.
- **Release names**: Sentry React Native + EAS use the app version/build; no extra config needed for release matching if you keep defaults.

---

## Quick checklist

| Step | Action |
|------|--------|
| 1 | Get org slug, project slug, and DSN from Sentry |
| 2 | In **app.json** and **ios/sentry.properties**: replace `your-sentry-org` and `your-sentry-project` |
| 3 | Run **eas env:create** for **EXPO_PUBLIC_SENTRY_DSN** (production + preview) |
| 4 | (Optional) **EXPO_PUBLIC_SENTRY_ENVIRONMENT** and **android/sentry.properties** |

After that, the next EAS build will upload source maps (using the existing token), and the app will send errors to Sentry when the DSN is set.

---

## How to check that Sentry is set up correctly

### 1. Config checklist (before building/running)

| Check | Where | What to verify |
|-------|--------|----------------|
| Org & project | **app.json** (Sentry plugin) | `organization` and `project` are your real Sentry org/project slugs, not `your-sentry-org` / `your-sentry-project`. |
| Org & project | **ios/sentry.properties** | `defaults.org` and `defaults.project` match the same org/project as app.json. |
| DSN in EAS | Expo dashboard or `eas env:list` | **EXPO_PUBLIC_SENTRY_DSN** exists for **production** and **preview** (value is your DSN from Sentry). |
| Auth token | Expo dashboard or `eas env:list` | **SENTRY_AUTH_TOKEN** exists as a **secret** for production/preview (used for source map uploads). |

Run locally to list EAS env vars (names only; values are hidden for secrets):

```bash
eas env:list
```

### 2. Send a test event from the app

After you’ve set **EXPO_PUBLIC_SENTRY_DSN** (in EAS for the profile you’re using, or in `.env` for local), run the app and trigger a test event:

- **In code** (e.g. a temporary button or a dev/settings screen):

  ```ts
  import { captureSentryTestEvent, isSentryEnabled } from '@/lib/sentry';

  // Somewhere in your UI, e.g. "Send Sentry test"
  if (isSentryEnabled()) {
    captureSentryTestEvent();
    // Show toast: "Test event sent. Check Sentry in a few seconds."
  } else {
    // Show: "Sentry not enabled (no DSN set)."
  }
  ```

- **In Sentry**: Open your project → **Issues**. Within a few seconds you should see an event like **"PlayRate Sentry test event"** (level: info). That confirms the app can send events to Sentry.

### 3. Confirm source maps (after an EAS build)

- Run a **production** or **preview** build: `eas build --platform ios --profile production` (or preview).
- In the build logs, look for Sentry/source map upload success (no “Auth token is required” or upload errors).
- In **Sentry** → your project → **Settings → Source Maps** (or **Releases**): you should see a release (e.g. `PlayRate@1.1.0`) with uploaded artifacts. That confirms the auth token and org/project are correct for uploads.

### 4. Optional: trigger a test error

To verify that **errors** (not just messages) are received and that stack traces look correct:

```ts
import { Sentry, isSentryEnabled } from '@/lib/sentry';

if (isSentryEnabled()) {
  throw new Error('PlayRate Sentry test error');
}
```

Check **Sentry → Issues** for the new error. If source maps are set up, the stack trace should show your source file names and line numbers instead of minified/bundle lines.
