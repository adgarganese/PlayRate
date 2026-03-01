# Dark Mode Grey Proposal

## Current Dark Mode Palette
- `bg`: `#0B0F1A` (very dark blue-black - base background)
- `surface`: `#12182A` (dark blue - cards)
- `surfaceAlt`: `#161F35` (lighter blue - alternative surfaces)

## Candidate Greys

### Option 1: Blue-Tinted Greys (Maintains Color Harmony)
**Recommended**
- **`darkSurfaceSoft`**: `#0F1523` - Subtle blue-grey for large page backgrounds
  - Slightly lighter than `bg` (#0B0F1A) but keeps blue tint
  - Good contrast with `surface` cards
  
- **`darkSurfaceRaised`**: `#1A2238` - Lighter blue-grey for featured cards
  - Noticeably lighter than `surface` (#12182A) for visual hierarchy
  - Works well with Primary Blue (#0000FF) accents

### Option 2: Neutral Warm Greys
- **`darkSurfaceSoft`**: `#111827` - Warm neutral grey
- **`darkSurfaceRaised`**: `#1A2236` - Lighter warm grey

### Option 3: Pure Neutral Greys
- **`darkSurfaceSoft`**: `#101317` - Pure dark grey
- **`darkSurfaceRaised`**: `#1C1F26` - Pure medium grey

---

## Recommendation: **Option 1** (Blue-Tinted Greys)

**Rationale:**
- Maintains color harmony with existing blue palette
- Works beautifully with Primary Blue (#0000FF)
- Subtle enough to not feel jarring
- Provides clear visual hierarchy without being too bright

---

## Application Plan

### 1. **`darkSurfaceSoft`** (#0F1523)
**Where:**
- Home screen background (`app/(tabs)/index.tsx`)
- Courts list screen background (`app/courts/index.tsx`)

**Why:** These are large page backgrounds that benefit from a slightly lighter base to break up the "solid black" feel.

### 2. **`darkSurfaceRaised`** (#1A2238)
**Where:**
- Your Snapshot card (`components/GotGameSnapshotCard.tsx`)
- Court details header card (if needed)

**Why:** Featured/important cards should stand out slightly from regular cards to create visual hierarchy.

---

## Visual Hierarchy After Changes

**Page Background (soft):**
- `darkSurfaceSoft` (#0F1523) ← NEW
  - Home, Courts list

**Regular Cards:**
- `surface` (#12182A) ← Unchanged
  - Most cards throughout app

**Featured Cards (raised):**
- `darkSurfaceRaised` (#1A2238) ← NEW
  - Your Snapshot
  - Key CTAs/featured content

**Base Background:**
- `bg` (#0B0F1A) ← Unchanged
  - Other screens remain solid black

---

## Safety Checks
- ✅ Only backgroundColor changes
- ✅ No layout/spacing changes
- ✅ No typography changes
- ✅ All colors use theme tokens (no hardcoded hex)
- ✅ Text contrast remains readable
