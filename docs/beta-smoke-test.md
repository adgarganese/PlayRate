# PlayRate beta smoke test (iOS)

**Purpose:** Run this on a real iPhone against a production-like EAS preview build before inviting beta testers. Goal: confirm core flows work end-to-end and no major regressions.

**Estimated time:** ~45 minutes

**Before you start**

- **Test account:** _(fill in: email / phone used for this run)_
- Open **PostHog** (Live events / Activity) and **Sentry** (Issues) in browser tabs before you start; glance at them as you complete each flow so you catch missing events or new errors immediately.

---

## A. Sign-in / auth

**What:** Email/password and phone OTP sign-in, sign-out, and auth analytics.

1. - [ ] If signed in, sign out completely.
2. - [ ] Sign in with **email + password**.
3. - [ ] Confirm you land on the **home** tab (main app shell, not sign-in).
4. - [ ] Sign out.
5. - [ ] Sign in with **phone OTP** (SMS code flow).
6. - [ ] Confirm you land on the **home** tab again.

**Expected result:** No stuck loading, no duplicate sessions, no unexpected “session expired” after landing on home.

**Verify in dashboards**

- **PostHog:** `sign_in_completed` with `method: 'email'` after email sign-in; `sign_out` after sign-out; `sign_in_completed` with `method: 'phone'` after OTP sign-in (order: email → sign_out → phone).
- **Sentry:** No new issues tied to these steps.

---

## B. Profile

**What:** Profile edits, avatar, and analytics for profile changes; avatar visible everywhere it should be.

1. - [ ] Open the **Profile** tab.
2. - [ ] Open **edit profile**; change the **bio** (use a short unique string); save.
3. - [ ] **Upload or change avatar** (pick image, save/confirm as the app requires).
4. - [ ] Go to **home** tab — confirm your **avatar** shows where your identity appears.
5. - [ ] Open **Athletes** (or equivalent list) — confirm **avatar** appears on your row/card.
6. - [ ] Return to **your profile** — confirm **avatar** and **updated bio** show.

**Expected result:** Saves succeed without error toasts; avatar updates everywhere within a few seconds (pull to refresh if the list caches).

**Verify in dashboards**

- **PostHog:** `profile_updated` with `fields_changed` including the fields you changed (e.g. bio, avatar-related field names as the app sends them).
- **Sentry:** No new issues.

---

## C. Post a highlight

**What:** New highlight from the create flow (video path) and draft → publish path; feed and analytics.

1. - [ ] Navigate to **create highlight** (new post / camera flow).
2. - [ ] **Record** a short clip or **pick** a video (~5–10s).
3. - [ ] Select a **sport**.
4. - [ ] Add a **caption**; **post** (not save as draft for this path).
5. - [ ] Open the **highlights feed** (or your profile highlights) and confirm the new post **appears**.
6. - [ ] Start a **second** highlight; add media + sport + caption; **save as draft** only.
7. - [ ] Open **drafts** (or draft entry point); **publish** that draft.

**Expected result:** Posted highlight is visible in feed; published draft appears like a normal highlight after publish.

**Verify in dashboards**

- **PostHog:** `highlight_posted` with `sport` set, `media_type: 'video'`, `was_draft: false` for the first post; second firing with `was_draft: true` when you publish the draft.
- **Sentry:** No new issues.

---

## D. Court check-in

**What:** Court detail, check-in, rating, photo upload, and related events. _(Use a court you know exists in this environment — e.g. one you’ve used before or that appears in search.)_

1. - [ ] Open **Courts** tab.
2. - [ ] Open **one real court** (search or list — pick one that loads detail).
3. - [ ] Tap **check in** (or equivalent); complete any on-screen confirmation.
4. - [ ] Confirm UI shows **checked-in** state (badge, label, or disabled check-in as designed).
5. - [ ] Submit a **star rating** (or the app’s rating control) for that court.
6. - [ ] **Upload a court photo** (take or pick photo; finish upload flow).

**Expected result:** Check-in and rating persist after leaving and re-opening the court if the app is supposed to persist them (spot-check once).

**Verify in dashboards**

- **PostHog:** `court_checked_in` with `court_id`; `court_rated`; `court_photo_uploaded` (properties as your build sends them).
- **Sentry:** No new issues.

---

## E. DMs

**What:** Inbox, new thread, send message, recipient display, analytics.

1. - [ ] Open **Inbox**.
2. - [ ] **Start** a conversation with **another test user** or an existing athlete you can message.
3. - [ ] Send **one short message**.
4. - [ ] Confirm the **message appears** in the thread and the **other user** shows as the recipient / thread title as designed.

**Expected result:** Message sends without error; thread opens from inbox reliably.

**Verify in dashboards**

- **PostHog:** `dm_sent` including `thread_id`.
- **Sentry:** No new issues.

---

## F. Follow / social

**What:** Athletes search (prefix / `ilike` path — exercises username index), profile, follow, follow analytics, optional cosign.

1. - [ ] Open **Athletes** tab.
2. - [ ] **Search** by username for a user you know exists (partial prefix is fine).
3. - [ ] Open their **profile**.
4. - [ ] Tap **Follow**; confirm UI shows **following** state.
5. - [ ] _(If your build supports cosigns on past runs)_ Open a **past run** for that user and **cosign**.

**Expected result:** Search returns the user quickly; follow toggles clearly.

**Verify in dashboards**

- **PostHog:** `follow_added` with **empty properties** (no `target_user_id` per current contract); if you cosigned, `cosign_given`.
- **Sentry:** No new issues.

---

## G. Push notifications (device-level sanity)

**What:** Permission state, inbound DM push, deep open, analytics.

1. - [ ] Recall whether a **notification permission** prompt appeared earlier in this session. If not, open **Settings → PlayRate → Notifications** and confirm PlayRate is **allowed** (or note if you intentionally denied for this run).
2. - [ ] Have **another user** send you a **DM** while the app is backgrounded or phone locked.
3. - [ ] Confirm a **push** appears on the **lock screen** (or banner).
4. - [ ] **Tap** the notification and confirm the app opens **directly to that conversation**.

**Expected result:** Tapping notification does not open a blank screen or wrong tab.

**Verify in dashboards**

- **PostHog:** `notification_opened` with `notification_type: 'push'` (after tap).
- **Sentry:** No new issues.

---

## H. Error handling sanity check

**What:** Deliberate error reporting and recovery after a bad state.

1. - [ ] **Option A:** On a **dev** build, open **Settings** and use **Test Sentry** (or equivalent) to trigger the intentional test. **Option B:** On preview only, trigger a **known safe error path** (e.g. an action that shows an error UI without corrupting data — use only paths your team has agreed are safe).
2. - [ ] In **Sentry**, confirm the **expected** test issue/event appears (or the agreed error is captured).
3. - [ ] **Force-quit** the app; reopen and complete **one** simple navigation (e.g. home tab).

**Expected result:** App launches clean; no immediate re-crash on cold start.

**Verify in dashboards**

- **PostHog:** _(no specific event required for this section unless your test path fires one)_
- **Sentry:** Only the **intentional** test (or agreed error), not a flood of new issues.

---

## Sign-off

- [ ] All flows completed without unexpected errors
- [ ] All expected PostHog events verified in dashboard
- [ ] No unexpected Sentry events logged (only the intentional test event, if any)

| Field | Value |
|--------|--------|
| Tester name | __ |
| Date | _ _ |
| Device | _e.g. iPhone 15 Pro, iOS 18.x_ |
| Build profile | _preview / production_ |
| Build number | _ _ |
