# Location restriction audit (Rhode Island / narrow region)

**Date:** Audit completed per request.  
**Scope:** Entire codebase – frontend, Supabase queries, API/helpers, constants/config, onboarding, courts/runs/athletes/discovery, search/location flows, migrations/seed data.

---

## Result: No Rhode Island–only or narrow region restriction exists

No code limits the app to Rhode Island, a single state, or a small fixed region. No changes were required.

---

## What was checked

### 1. Explicit Rhode Island / region terms
- **Searched for:** Rhode Island, RI, Providence, Cranston, Warwick, Pawtucket, Newport, Bristol, Woonsocket, Narragansett, 029xx zip codes.
- **Result:** No matches in app source. (Only unrelated hits in `package-lock.json` and `ReleaseNotes.html`.)

### 2. Hardcoded coordinates
- **Searched for:** 41.x / 71.x (Rhode Island approx.), and other fixed lat/lng.
- **Result:** No RI coordinates. Only location-related numbers:
  - **`app/(tabs)/courts/find.tsx`** – `DEFAULT_REGION`: `40.7128, -74.0060` (New York City). Used only as the **initial map view** when the user has not granted location or moved the map. Comment says "central US location as fallback" (geographically inaccurate). This is **not** a data restriction: courts are loaded for whatever region the map shows or for "Use my location"; it does not limit courts, runs, athletes, or discovery to NYC or any single region.
  - **`supabase/migrations/20260215160006_postgis_courts_location.sql`** – Example call `courts_nearby(40.71, -74.00, 10000)` and smoke row are inside a **comment block** (documentation only); they are not executed.

### 3. State / region / city filters in queries
- **Searched for:** `.eq('state', ...)`, `.eq('region', ...)`, `.eq('city', ...)`, state_id, country filters that would limit to one state/region.
- **Result:** No state/region/city filters in Supabase queries. Court and run logic uses:
  - **`fetchCourtsNearLocation(centerLat, centerLng, radiusKm)`** – center and radius from map or user location (dynamic).
  - **`fetchRecommendedRuns(userLat, userLng)`** – fetches up to 100 courts globally, then scores by distance when user location is present; no fixed state/region.

### 4. Frontend filters and discovery
- **Courts (Find):** Uses map region and `fetchCourtsNearLocation`; no state/region dropdown or RI-only filter.
- **Recommended runs (Home):** Uses `fetchRecommendedRuns(userLat, userLng)`; no region lock.
- **Athletes / recommended friends:** Profiles by `created_at` and follow state; no location or state filter.
- **Onboarding / defaults:** No location or region defaults in constants or config.

### 5. API / helpers / config
- **`lib/courts-api.ts`:** `fetchCourtsNearLocation` uses bounding box from center + radius (no state). Default `radiusKm = 10` is a generic “nearby” default, not a region restriction.
- **`lib/courts-recommendations.ts`:** Fetches courts without location filter; distance scoring when user has coordinates. No state/region.
- **`lib/config.ts`** and env: No location/state/region defaults.

### 6. Maps, Places, location flows
- **`app/(tabs)/courts/find.tsx`:** Google Places Autocomplete uses `components: 'country:us'` – restricts **country** to US, not to a single state or Rhode Island. Comment: "Restrict to US (optional, remove for global)."
- **Location permission / “Use my location”:** Uses device location; no override or pin to RI.

### 7. Database (migrations, RPCs, seed)
- **Migrations / RPCs:** No RLS or queries filter by state, region, or Rhode Island. `courts_nearby` takes lat, lng, radius (meters).
- **Seed / test data:** No RI-specific seed; migration example coordinates are in comments only.

---

## Summary table

| Area                    | Rhode Island / narrow restriction? | Notes |
|-------------------------|-------------------------------------|--------|
| Frontend filters        | No                                  | No state/region filters. |
| Supabase queries        | No                                  | Courts/runs by location + radius or global then distance. |
| API/helpers             | No                                  | No state/region params. |
| Constants/config/env    | No                                  | No location defaults. |
| Onboarding/defaults     | No                                  | None. |
| Courts/runs/athletes    | No                                  | Dynamic location or global + distance. |
| Discovery/recommended   | No                                  | Same. |
| Search/Places           | No                                  | Country: US only (not state/region). |
| DB policies/SQL/views   | No                                  | No state/region filters. |
| Seed/mock/test data     | No                                  | No RI-specific seed. |

---

## Intent vs accident

- **DEFAULT_REGION (NYC):** Intentional fallback for the map when the user has no location. Not a data restriction; not Rhode Island.
- **`country:us`:** Intentional bias for Places autocomplete to US; not a single state or region.
- **Default radius 10 km:** Intentional “nearby” default; not a region lock.

None of these are Rhode Island–only or narrow-region restrictions.

---

## User-facing impact

- **None** from Rhode Island–only or narrow-region logic, because none exists.
- Courts, runs, and discovery are driven by map region or user location (and recommended runs by global set + distance). No artificial limit to Rhode Island or any single small region.

---

## Files changed

**None.** No Rhode Island or narrow location restriction was found, so no code was modified.

---

## Manual follow-up

None required for this audit. If you later want to:
- Allow **global** Places autocomplete: remove or change `components: 'country:us'` in `app/(tabs)/courts/find.tsx` (line ~190).
- Change the **map initial view** when location is off: adjust `DEFAULT_REGION` in the same file (e.g. different city or a true “central US” coordinate); this still does not restrict data to that area.
