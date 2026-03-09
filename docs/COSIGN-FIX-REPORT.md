# Cosign feature fix – report

**Date:** 2025-02-28  
**Scope:** Cosign flow only; no unrelated UI/UX changes.

---

## 1. Root cause(s)

1. **One cosign per attribute ever**  
   The DB had a unique index `cosigns_profile_unique` on `(from_user_id, to_user_id, attribute)` WHERE `run_id IS NULL`, so a viewer could only insert one profile cosign per attribute per player. Re-cosigning after 30 days was impossible.

2. **UI treated “ever cosigned” as “can never cosign again”**  
   `canCosign` was `!userHasCosigned`, so once a user had cosigned an attribute they were never shown as able to cosign again, even after 30 days.

3. **Cooldown used wrong timestamp when multiple cosigns exist**  
   User cosigns were loaded without `ORDER BY created_at DESC`, and the code kept the last row seen per attribute instead of the latest by date. After allowing multiple cosigns per 30-day window, the “most recent” cosign per attribute must be used for the 30-day check.

4. **Button stayed disabled after cooldown**  
   `AttributeRow` passed `disabled={!canCosign || hasCosigned}`, so the button stayed disabled whenever the user had ever cosigned, even when `canCosign` was true after 30 days.

5. **“Cosigned” state shown after cooldown**  
   The pill showed “Cosigned” (and dimmed) whenever `hasCosigned` was true. After 30 days it should show “Cosign” again and be normal; dimming should only apply during the 30-day window.

6. **Some attribute names didn’t map to slugs**  
   `attributeNameToSlug` only did exact/case-insensitive match on `COSIGN_ATTRIBUTE_LABELS`. Display names that were variants (e.g. “Perimeter Defense”) could return `null`, so those attributes were not cosignable.

---

## 2. Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260228140000_cosigns_30day_cooldown.sql` | **New.** Drop `cosigns_profile_unique`; replace profile insert policy with 30-day cooldown (no insert if same from/to/attribute in last 30 days). |
| `app/athletes/[userId]/index.tsx` | Order user cosigns by `created_at desc`; keep only latest `created_at` per attribute; set `canCosign = !userHasCosigned \|\| !isCosignPending`; after successful cosign call `loadRatingsForSport(selectedSportId)` instead of optimistic update; pass `cosignLoading`; modal hint: “once every 30 days”. |
| `components/attribute-row.tsx` | Pass `cosigned={hasCosigned && isCosignPending}`; `disabled={!canCosign \|\| cosignLoading}` (no `hasCosigned` in disabled). |
| `lib/recap.ts` | In `attributeNameToSlug`, add fallback: if no exact match, match by substring so more display names map to a valid slug. |

---

## 3. SQL / schema / policy changes required

**Run this migration (in Supabase SQL Editor or via your migration path):**

- **File:** `supabase/migrations/20260228140000_cosigns_30day_cooldown.sql`

**Contents (summary):**

1. **Drop index:** `DROP INDEX IF EXISTS cosigns_profile_unique;`
2. **Replace policy:** Drop `cosigns_insert_profile_scoped`, then create new `cosigns_insert_profile_scoped` that allows INSERT when:
   - `auth.uid() = from_user_id`
   - `from_user_id != to_user_id`
   - `run_id IS NULL`
   - and there is **no** existing row in `cosigns` with the same `from_user_id`, `to_user_id`, `attribute`, `run_id IS NULL`, and `created_at > now() - interval '30 days'`

No table schema changes (column types or new columns). Run-scoped cosigns and their RLS are unchanged.

---

## 4. Cooldown logic

- **Source of truth:** `cosigns.created_at` for the **latest** cosign per (viewer, target, attribute) with `run_id IS NULL`.
- **Definition:** Viewer is “on cooldown” for that attribute for that player if they have at least one such cosign with `created_at` within the last **30 days** (30 × 24 × 60 × 60 × 1000 ms in the app).
- **UI:** `isCosignPending = userHasCosigned && (now - latest created_at < 30 days)`.
- **Can cosign again:** `canCosign = authenticated && !ownProfile && (!userHasCosigned || !isCosignPending)`.
- **Data layer:** RLS blocks INSERT if an existing profile cosign (same from, to, attribute) has `created_at` in the last 30 days. Prevents duplicates and enforces cooldown even if the client is wrong or out of date.

---

## 5. All player attributes cosignable

- **Before:** Only attribute names that exactly (or case-insensitively) matched `COSIGN_ATTRIBUTE_LABELS` got a slug; others returned `null` and showed “This skill cannot be cosigned”.
- **After:** `attributeNameToSlug` first tries exact/case-insensitive match; if none, it tries a substring match (display name contains label or label contains normalized name). Any match returns one of the 10 allowed slugs, so all attributes that map to one of those labels are cosignable. The DB `CHECK (attribute IN (...))` is unchanged; we only improved the mapping from display name → slug.

---

## 6. Dimmed pill during cooldown

- **During 30-day cooldown:** `hasCosigned && isCosignPending` → `CosignButton` gets `cosigned={true}` and `isPending={true}` → pill shows “Cosigned” and opacity 0.5 (dimmed), and is disabled.
- **After 30 days:** `hasCosigned && !isCosignPending` → `cosigned={false}`, `isPending={false}` → pill shows “Cosign”, normal opacity, enabled.
- **Never cosigned:** Pill shows “Cosign”, normal, enabled when `canCosign`.

No redesign of the component; only which props are passed so that dimming and label reflect cooldown correctly.

---

## 7. Regression checklist (what to test)

- [ ] **Cosign once:** Open another user’s profile → Cosign an attribute → submit → success; count increases; that attribute’s pill shows “Cosigned” and is dimmed.
- [ ] **Block duplicate within 30 days:** Same attribute again → pill disabled and dimmed; if modal is opened by some other path, submit should fail with clear error (RLS or 23505).
- [ ] **Re-cosign after 30 days:** After 30 days (or after manually adjusting `created_at` in DB for testing), same attribute → pill shows “Cosign” and is tappable; submit succeeds; new row in `cosigns`; pill goes to “Cosigned” and dimmed again.
- [ ] **Self-cosign blocked:** Own profile → no Cosign or Cosign disabled / not offered; if attempted, DB or RLS returns error and message is clear.
- [ ] **All attributes:** For every skill rating on a profile, Cosign appears and (when not self and not on cooldown) is tappable; no “invalid attribute” for normal attribute names.
- [ ] **Run recap cosigns:** Unchanged; run-scoped cosigns still work and are still one per (from, to, run, attribute).
- [ ] **Modal copy:** Modal says “You can cosign each skill once every 30 days.”
- [ ] **Loading state:** While submitting, the row’s Cosign button shows loading and is disabled; after success, ratings refetch and pill reflects new state.
