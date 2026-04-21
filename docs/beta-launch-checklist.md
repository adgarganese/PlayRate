# Beta launch checklist

Use this before shipping a beta build and when onboarding new testers.

**Distribution:** Beta is distributed via **TestFlight (iOS)** and **Google Play Internal Testing** (or equivalent), using **manual EAS builds**.

**Git/CI:** No CI or “build on push” workflows for beta. Builds are triggered manually only. When you’re ready for CI, you can add workflows later.

---

## 1. Environment variables

**Required for the app (see `.env` / `.env.txt`):**

| Variable | Purpose | Beta note |
|----------|---------|-----------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL | Use **staging** project URL for beta if you use a separate project. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Staging anon key for beta when using staging. **Never** use `service_role` in the app. |
| `POSTHOG_API_KEY` | Analytics (optional but recommended) | Set for beta to get events. |
| `EXPO_PUBLIC_SENTRY_DSN` | Crash reporting (optional) | Set for beta to get crash reports; leave unset in dev. |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | Sentry environment tag | e.g. `beta`. |
| `EXPO_PUBLIC_SUPPORT_EMAIL` | “Report a problem” mailto | Your support address. |

- Ensure `.env` is **not** committed (it’s in `.gitignore`). Run `git ls-files .env`; if it appears, run `git rm --cached .env` and commit.
- **For beta EAS builds**, set these as **EAS environment variables** so they are available in the cloud build without committing keys. See **Runbooks → Cutting a beta build** for how to set env vars for beta.

---

## 2. Staging Supabase setup (optional)

If you use a **separate Supabase project for beta**:

1. Create a second project in [Supabase Dashboard](https://supabase.com/dashboard) (e.g. `athlete-app-staging`).
2. In project **Settings → General**, copy **Project URL** and **anon public** key.
3. Put them in `.env.beta` (or EAS env for beta profile) as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
4. Link the Supabase CLI to the staging project and push migrations (see **Runbooks → Pushing migrations**).
5. Use this env only for beta builds so you can wipe or reset staging without affecting production.

---

## 3. Migrations

- All migrations live in `supabase/migrations/` (ordered by timestamp).
- Apply them to the project the app uses (staging or production) **before** shipping a build that expects the new schema.
- Use the same migration order everywhere; do not edit applied migrations.

See **Runbooks → Pushing migrations**.

---

## 4. RLS sanity checks

- **App uses anon key only** – no `service_role` in client code (see `lib/supabase.ts`). RLS is enforced for all app requests.
- After applying migrations that add or change RLS, verify:
  - **Signed-in users** can read/write their own data (profiles, follows, check-ins, cosigns, etc.) and only what policies allow.
  - **Public read** where intended (e.g. courts, runs, profiles for discovery) and **no public write** for sensitive tables.
- Quick check: run the smoke test (see **Runbooks → Running smoke tests**) and spot-check key flows (sign up, open court, join run, check-in, recap, cosign) in the app.

---

## 5. Sentry verification

- **Enable for beta:** set `EXPO_PUBLIC_SENTRY_DSN` (and optionally `EXPO_PUBLIC_SENTRY_ENVIRONMENT=beta`) in the build env.
- **Verify:** trigger a test crash or use Sentry’s “Test” button in the project settings; confirm the event appears with release, user id, and tags (platform, app_version, route).
- **Where to check:** [Sentry](https://sentry.io) → your project → Issues / Discover. Filter by environment `beta` and release.

---

## 6. PostHog verification

- **Enable:** set `POSTHOG_API_KEY` (or `EXPO_PUBLIC_POSTHOG_API_KEY`) in the build env.
- **Verify:** sign up or sign in, open home, open a court, join a run, check in, open recap, give a cosign, tap “Report a problem.” In PostHog, check **Live events** (or **Events**) for: `sign_up_completed`, `login_completed`, `home_viewed`, `court_opened`, `run_opened`, `run_joined`, `check_in_completed`, `recap_opened`, `cosign_given`, `recap_completed`, `rep_level_up`, `report_problem_tapped`.
- **Where to check:** [PostHog](https://us.posthog.com) (or your host) → Project → Activity / Live events / Insights. See also `docs/ANALYTICS-EVENTS.md`.

---

## 7. Build and tester steps

- **Cut a beta build** manually (see **Runbooks → Cutting a beta build**). No CI—run the steps yourself when you want a new beta.
- **Release to TestFlight (iOS)** and **Google Play Internal Testing (Android)** (see **Runbooks → Cutting a beta build** and **Adding testers**).
- Tell testers:
  - How to install (TestFlight invite / Play Internal Testing link).
  - To use “Report a problem” (Account screen) for feedback; it attaches device/app/user context.
  - That analytics and crash reporting are on for beta (link to privacy policy if required).
- **Post-beta:** Add a monochrome transparent Android notification icon asset and set the `icon` field on the `["expo-notifications", { ... }]` plugin entry in `app.json`.

---

# Runbooks

Repeatable steps for common operations.

---

## Pushing migrations

**Prereqs:** Supabase CLI installed, logged in (`supabase login`), and (for staging) linked to the right project.

1. **Link to the target project** (if not already):
   ```bash
   supabase link --project-ref <project-ref>
   ```
   Project ref is in Dashboard → Settings → General.

2. **Push all pending migrations:**
   ```bash
   supabase db push
   ```
   This applies migrations in order. Resolve any conflicts before re-pushing.

3. **Optional – confirm applied:**
   - Dashboard → Database → Migrations, or
   - `supabase migration list`

---

## Running smoke tests

**Prereqs:** Supabase project (staging or prod) with migrations applied; DB credentials or “Run SQL” in Dashboard.

1. Open the Supabase **SQL Editor** for the project (or use `psql` with the DB URL).
2. Run the smoke test script:
   - File: `supabase/smoke-test-runs-cosign.sql`
   - It creates test data (runs, participants, cosigns) and exercises triggers (e.g. rep rollups). Cleanup is at the end of the script.
3. Confirm no errors. If something fails, fix migrations or RLS before shipping.

---

## Cutting a beta build

Beta uses **manual EAS builds** only (no CI). Run these steps when you want to ship a new beta.

### Prereqs

- EAS CLI: `npm i -g eas-cli`
- Logged in: `eas login`
- Project linked to EAS: `eas init` (if not already)

### Step 1: Set environment variables for beta builds

Env vars must be available to the EAS build in the cloud. Use **one** of these approaches (EAS environment variables are preferred so keys stay out of the repo).

**Option A – EAS environment variables (recommended)**

Use [`eas env:create`](https://docs.expo.dev/eas/environment-variables/manage/) per **environment** (`preview`, `production`, etc.). Choose **visibility** carefully:

- **`EXPO_PUBLIC_SUPABASE_URL`** → **`sensitive`**. The URL is embedded in the client bundle anyway; `sensitive` (not `secret`) lets it resolve locally and appear in `eas env:pull` output, while still masking it in logs where appropriate.
- **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** → **`secret`**. Treat the anon key as a credential.

Example (repeat `--environment` for each env you use, e.g. `preview` and `production`):

```bash
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://nhqhkwvmludnsblimjeu.supabase.co--environment preview --visibility sensitive
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value sb_publishable_AoSr87sbmoHs55ihCAkCBQ_v5nLyH83--environment preview --visibility secret
eas env:create --name EXPO_PUBLIC_POSTHOG_API_KEY --value "phc_..." --environment preview --visibility secret
eas env:create --name EXPO_PUBLIC_SENTRY_DSN --value "https://...@sentry.io/..." --environment preview --visibility secret
eas env:create --name EXPO_PUBLIC_SENTRY_ENVIRONMENT --value "beta" --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPPORT_EMAIL --value "support@yourdomain.com" --environment preview --visibility plaintext
```

List: `eas env:list --environment preview`. Update: `eas env:update` or the Expo dashboard (**Project settings → Environment variables**).

**If `EXPO_PUBLIC_SUPABASE_URL` already exists as `secret`**, switch it to `sensitive` (run once per environment):

```bash
eas env:update --variable-name EXPO_PUBLIC_SUPABASE_URL --variable-environment preview --visibility sensitive
eas env:update --variable-name EXPO_PUBLIC_SUPABASE_URL --variable-environment production --visibility sensitive
```

(Re-enter the same URL if the CLI prompts for a value.)

**Legacy `eas secret:create`** still works for project-scoped secrets, but prefer **`eas env:create`** with explicit visibility and environments for new setups.

**Option B – Profile env in `eas.json`**

You can put non-sensitive values in `eas.json` under the build profile’s `env`:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_SENTRY_ENVIRONMENT": "beta",
        "EXPO_PUBLIC_SUPPORT_EMAIL": "support@yourdomain.com"
      },
      "ios": { "simulator": false }
    }
  }
}
```

**Do not** put Supabase keys, PostHog key, or Sentry DSN in `eas.json` if the repo is shared—use EAS environment variables for those.

**Expo docs:** [Environment variables in EAS](https://docs.expo.dev/eas/environment-variables/manage/).

### Step 2: Bump version (optional)

- Update user-visible version and store build id together: `app.json` (`expo.version`, `expo.runtimeVersion`, `ios.buildNumber`, `android.versionCode`), `package.json`, native `ios/PlayRate/Info.plist`, `ios/PlayRate.xcodeproj/project.pbxproj` (`MARKETING_VERSION`, `CURRENT_PROJECT_VERSION`), and any fallbacks in `lib/` (e.g. `feedback.ts`, `sentry.ts`).
- EAS bumps build numbers automatically; you can override in the profile if needed.

### Step 3: Run the build (manual)

From the project root:

```bash
# Both platforms
eas build --platform all --profile preview

# Or one platform at a time
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

Use the profile you configured (e.g. `preview`). Builds run on EAS servers; watch status at [expo.dev](https://expo.dev) → your project → Builds.

### Step 4: Release to TestFlight (iOS) and Google Play Internal Testing (Android)

**iOS – TestFlight**

1. When the iOS build finishes, download the build from the EAS dashboard or run:
   ```bash
   eas build:run --platform ios --profile preview --latest
   ```
2. **Submit to TestFlight** (choose one):
   - **EAS Submit:**  
     ```bash
     eas submit --platform ios --latest --profile preview
     ```  
     (Configure Apple credentials when prompted, or set them in EAS.)
   - **Manual:** Download the `.ipa` from EAS, then in App Store Connect → your app → TestFlight → open the build and upload the IPA (or use Transporter).
3. After processing, the build appears in TestFlight. Add testers (see **Adding testers**).

**Android – Google Play Internal Testing**

1. When the Android build finishes, you get an `.aab` (or `.apk`) from the EAS dashboard.
2. **Upload to Internal Testing** (choose one):
   - **EAS Submit:**  
     ```bash
     eas submit --platform android --latest --profile preview
     ```  
     (Configure a Google Service Account and internal track when prompted.)
   - **Manual:** In [Google Play Console](https://play.google.com/console) → your app → **Testing** → **Internal testing** → create (or use existing) release → upload the `.aab` from EAS.
3. After processing, add testers to the internal track (see **Adding testers**).

### Step 5: Notify testers

Share the TestFlight link (or invite by email) and the Play Internal Testing link. Tell them which version/build to use if you have multiple.

---

## Adding testers

**iOS – TestFlight**

- **App Store Connect** → your app → **TestFlight**.
- **Internal testing:** Add team members (up to 100) by email; they get an invite.
- **External testing:** Create a group, add testers by email, submit a build for review (first time). Testers receive a public link or email to install.

**Android – Google Play Internal Testing**

- **Google Play Console** → your app → **Testing** → **Internal testing**.
- Create a release (or use existing), upload the `.aab` from EAS if you haven’t already.
- Open **Testers** tab → create a list (e.g. “Beta testers”) and add email addresses. Save and copy the **opt-in link**.
- Share the opt-in link with testers; they join the list and can install the app from the Play Store (Internal testing track).

Keep a simple list of tester emails and which build/version they’re on so you can correlate feedback (and Sentry/PostHog) with releases.

---

## Where to check errors and analytics

| What | Where |
|------|--------|
| **Crashes / errors** | [Sentry](https://sentry.io) → your project → **Issues** or **Discover**. Filter by environment `beta`, release, or user. |
| **Analytics events** | [PostHog](https://us.posthog.com) (or your host) → **Activity** / **Live events** or **Insights**. See `docs/ANALYTICS-EVENTS.md` for the beta event list. |
| **Build status** | [Expo EAS](https://expo.dev) → your project → Builds. |

---

*Last updated for beta prep. Adjust project refs, profile names, and URLs to match your setup.*
