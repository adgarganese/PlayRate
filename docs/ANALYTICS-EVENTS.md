# PostHog – Beta must-have events

These events are used for beta analytics. All are fired via `track()` or `trackOnce()` from `@/lib/analytics`.

| Event | When | Location |
|-------|------|----------|
| **sign_up_completed** | User completes email sign-up successfully | `app/sign-up.tsx` (method: 'email') |
| **login_completed** | User signs in successfully (email) | `app/sign-in.tsx` (method: 'email') |
| **home_viewed** | Home tab is viewed (once per mount) | `app/(tabs)/index.tsx` (trackOnce) |
| **court_opened** | User opens a court detail screen | `app/(tabs)/courts/[courtId].tsx` (court_id, court_name) |
| **run_opened** | User opens a run detail screen | `app/(tabs)/courts/run/[runId].tsx` (trackOnce; run_id, band) |
| **run_joined** | User joins a run (tap “Join run”) | `lib/runs.ts` `joinRun()` (run_id) |
| **check_in_completed** | User checks in at a court | `app/(tabs)/courts/[courtId].tsx` (run_id) |
| **recap_opened** | User opens run recap screen | `app/runs/[id]/recap.tsx` (trackOnce; run_id) |
| **cosign_given** | User gives a cosign on recap | `app/runs/[id]/recap.tsx` |
| **recap_completed** | User completes recap (submits cosigns) | `app/runs/[id]/recap.tsx` (run_id, cosigns_count) |
| **rep_level_up** | User’s rep level increases (from recap) | `app/runs/[id]/recap.tsx` |
| **report_problem_tapped** | User taps “Report a problem” in Account | `app/(tabs)/profile/account.tsx` |

Other events (e.g. `run_recommendations_viewed`, `notification_opened`, `dm_sent`) are optional for beta.
