# Design system audit — PlayRate

Generated from the codebase (snapshot). **App name:** PlayRate. Primary design direction is documented in `constants/theme.ts` (“50% 2K energy + 50% sleek/minimal”, high contrast, cyan/gold accents used sparingly).

---

## 1. Color palette

### 1.1 `ThemeProvider` / `useThemeColors()` resolved tokens

`contexts/theme-context.ts` maps **light** (`LightColors` + `PRIMARY`) vs **dark** (`DarkColors` + `brandBlueDark` / `brandBlueTextDark` for primary UI). Accent tokens are shared.

| Token | Light mode source | Value (light) | Dark mode source | Value (dark) |
|--------|-------------------|---------------|------------------|---------------|
| `bg` | `LightColors.bg` | `#EEF1F5` | `DarkColors.bg` | `#070A10` |
| `surface` | `LightColors.surface` | `#FFFFFF` | `DarkColors.surface` | `#1A2238` |
| `surfaceAlt` | `LightColors.surfaceAlt` | `#F7F8FB` | `DarkColors.surfaceAlt` | `#1F2A42` |
| `surfaceSoft` | `LightColors.surfaceSoft` | `#EEF1F5` | `DarkColors.surfaceSoft` | `#171C2A` |
| `surfaceRaised` | `LightColors.surfaceAlt` *(not `LightColors.surfaceRaised`)* | `#F7F8FB` | `DarkColors.surfaceRaised` | `#232B42` |
| `surfaceElevated` | `LightColors.surfaceElevated` | `#FFFFFF` | `DarkColors.surfaceElevated` | `#1E2640` |
| `border` | `LightColors.border` | `#D8DEE9` | `DarkColors.border` | `#2A3A54` |
| `text` | `LightColors.text` | `#0B1020` | `DarkColors.text` | `#F4F7FF` |
| `textMuted` | `LightColors.textMuted` | `#5B657A` | `DarkColors.textMuted` | `#B8C4D8` |
| `textOnPrimary` | `LightColors.textOnPrimary` | `#FFFFFF` | `DarkColors.textOnPrimary` | `#FFFFFF` |
| `primary` | `PRIMARY` | `#0000FF` | `brandBlueDark` | `#38BDF8` |
| `primarySmallText` | `PRIMARY` | `#0000FF` | `brandBlueTextDark` | `#7B9EFF` |
| `cyanGlow` | `AccentColors.cyanGlow` | `#00E5FF` | *(same)* | `#00E5FF` |
| `goldTier` / `gold` | `AccentColors.goldTier` | `#E7C666` | *(same)* | `#E7C666` |
| `goldSoft` | `AccentColors.goldSoft` | `#F5E8C7` | *(same)* | `#F5E8C7` |
| `success` | `AccentColors.success` | `#22C55E` | *(same)* | `#22C55E` |
| `successSoft` | `AccentColors.successSoft` | `#DCFCE7` | *(same)* | `#DCFCE7` |
| `background` | `LightColors.background` | `#EEF1F5` | `DarkColors.background` | `#070A10` |
| `card` | `LightColors.card` | `#FFFFFF` | `DarkColors.card` | `#1A2238` |
| `textPrimary` | `LightColors.textPrimary` | `#0B1020` | `DarkColors.textPrimary` | `#F4F7FF` |

**Also in `constants/theme.ts` (not all exposed on context):**

- `PRIMARY` / `brandBlue`: `#0000FF`
- `PlayRateColors` (legacy): `#0A0A0A`, `#1A1A1A`, `#FFFFFF`, `#999999`, `#FFD700`, `#D6A73B`, `#2A2A2A`
- `Shadows`: iOS `shadowColor` `#000` (light) or `AccentColors.cyanGlow` (dark)
- `Fonts` web stack strings (no hex)

**React Navigation themes** (`app/_layout.tsx` `customLightTheme` / `customDarkTheme`): align with light/dark text/bg/border for **light**, but dark mode **card** `#12182A` and **border** `#24304A` are **older values** than `DarkColors.surface` (`#1A2238`) / `DarkColors.border` (`#2A3A54`) — intentional drift risk for headers/cards that use the nav theme.

### 1.2 Hardcoded colors outside the theme object (representative list)

**Hex (deduped by purpose; see codebase for exact lines):**

| Area | Examples |
|------|-----------|
| **Media / overlays** | `#000`, `#fff` / `#FFF` / `#FFFFFF` — video/image chrome, FABs, modals, `ActivityIndicator` |
| **System-style destructive** | `#FF3B30` (iOS red) — e.g. trash, sign-out label |
| **Form errors** | `#FF0000` (Phone/Otp), `#FF6B6B` (`ui/Input.tsx`) |
| **Maps** (`courts/find.tsx`) | `#0A0A0A`, `#999999` (Google map style JSON) |
| **Offline banner** | `#FFF7ED`, `#9A3412`, `#FDBA74` / `#3A2518`, `#FDBA74`, `#7C2D12` |
| **Error boundary** | `#EEF1F5`, `#0B1020`, `#64748b`, `#2563eb`, `#fff` |
| **Connection test (dev)** | `#fff`, `#f5f5f5`, `#e8f5e9`, `#ffebee`, `#2e7d32`, `#c62828`, `#666`, `#e3f2fd`, `#ccc` |
| **Explore (Expo template)** | `#D0D0D0`, `#353636`, `#808080` |
| **Cosign badge text** | `#0B1020` on gold |
| **Tier colors** (`lib/tiers.ts`) | `#9CA3AF`, `#6B7280`, `#3B82F6`, `#2563EB`, `#10B981`, `#059669`, `#F59E0B`, `#D97706`, `#8B5CF6`, `#7C3AED` |
| **themed-text link** | `#0a7ea4` |
| **TabBaselinePlaceholder** | `#f0f0f0`, `#333` |

**RGBA (examples):** `rgba(0,0,0,0.5)` / `0.9` (scrim), `rgba(255,255,255,0.8)` (message meta), `rgba(231, 198, 106, 0.08|0.12)` (CosignButton gold tint).

---

## 2. Typography

### 2.1 Fonts loaded in `app/_layout.tsx`

`useFonts({})` is called with an **empty object**. Intended brand fonts are **commented out**:

- `BarlowCondensed-ExtraBoldItalic`
- `BarlowCondensed-Bold`
- `Rajdhani-Medium`
- `Rajdhani-Regular`

`assets/fonts/README.md` describes downloading those TTFs; until then the app uses **system / normal** faces. On font error, `logger.warn` notes fallback to system fonts.

### 2.2 Shared text styles (`constants/theme.ts` → `Typography`)

| Variant | fontSize | fontWeight | lineHeight |
|---------|----------|------------|------------|
| `h1` | 32 | bold | 40 |
| `h2` | 24 | bold | 32 |
| `h3` | 18 | 600 | 24 |
| `body` | 16 | 400 | 24 |
| `bodyBold` | 16 | 600 | 24 |
| `muted` | 14 | 400 | 20 |
| `mutedSmall` | 12 | 400 | 16 |

### 2.3 Other fontSize values in the repo (beyond the table above)

**8, 9, 10, 11, 12, 13, 14, 15, 18, 20, 24, 32** appear in `StyleSheet` / inline styles (e.g. comments UI 11–14, `TierPill` 11/13/15, `CourtChat` 9–14, `PlayRatePlaceholder` 32/800 and 14/500, `themed-text` 16/20/32, `connection-test` 14–24).

**fontWeight** beyond 400/600/bold: `'500'`, `'700'`, `'800'` appear (e.g. placeholder title, pills).

**lineHeight** is often **omitted** on custom sizes; when set explicitly (e.g. comment body `14` / `20`), it diverges from `Typography`.

### 2.4 Shared vs inline

- **Shared:** `Typography` in `constants/theme.ts`; `AppText` maps variants `h1` | `h2` | `h3` | `body` | `bodyBold` | `muted` | `mutedSmall` to those styles + theme colors.
- **Also shared:** `ThemedText` / `ThemedView` (Expo template path, used on **Explore**).
- **Reality:** Most feature screens use **`StyleSheet.create`** plus **`Typography` spreads** (`...Typography.body`) **and** one-off `fontSize` / `fontWeight` overrides. True “single source” typography is **partial**.

---

## 3. Component inventory — `components/ui/`

| File | One-line description |
|------|----------------------|
| `AppText.tsx` | Themed text with typography variants and semantic colors (`text`, `textMuted`, `primary`, `textOnPrimary`). |
| `Button.tsx` | Primary/secondary pressable with sizes, loading state, theme + radius + shadows. |
| `collapsible.tsx` | Expand/collapse section using `ThemedText` / `ThemedView` + `IconSymbol`. |
| `CompactEmptyStateCard.tsx` | Small empty-state card with pill radius. |
| `EmptyState.tsx` | Standard empty state block (icon/title/message). |
| `ErrorScreen.tsx` | Full-screen error with message + retry. |
| `Header.tsx` | Screen header with back/title and optional right icon. |
| `icon-symbol.tsx` | **Android/web:** `@expo/vector-icons` **MaterialIcons** mapped from SF Symbol names. |
| `icon-symbol.ios.tsx` | **iOS:** `expo-symbols` `SymbolView` (SF Symbols). |
| `Input.tsx` | Legacy/simple labeled input with theme border + error color. |
| `KeyboardScreen.tsx` | `KeyboardAvoidingView` + scroll wrapper for forms. |
| `ListItem.tsx` | Row list item for settings-style lists. |
| `LoadingScreen.tsx` | Centered loading indicator + message. |
| `PasswordInput.tsx` | Password field with visibility toggle. |
| `Screen.tsx` | Safe-area padded screen with `colors.bg` and horizontal padding default `Spacing.lg`. |
| `SegmentedControl.tsx` | Custom two/segment toggle using theme colors. |
| `TextInput.tsx` | Themed text field aligned with app inputs. |

**Related (not under `ui/` but primary chrome):** `Card.tsx`, `SectionTitle`, headers — use `Spacing`, `Radius`, `Shadows`, `useThemeColors`.

### 3.1 Screens vs shared components

- **Heavy shared UI:** Auth flows, profile, courts, highlights, inbox/chat, onboarding (`Screen`, `Header`, `Card`, `Button`, `AppText`, `LoadingScreen`, `ErrorScreen`, `KeyboardScreen`).
- **Template / legacy:** `app/(tabs)/explore.tsx` uses `ParallaxScrollView`, `ThemedText`, `ThemedView`, `Collapsible` — feels like **default Expo starter**, not the main product skin.
- **Dev-only:** `connection-test.tsx` — hardcoded palette, not theme-driven.

---

## 4. Spacing and layout

### 4.1 Scale (`constants/theme.ts` → `Spacing`)

| Token | px |
|-------|-----|
| `xs` | 4 |
| `sm` | 8 |
| `md` | 12 |
| `lg` | 16 |
| `xl` | 24 |
| `xxl` | 32 |

**LegacySpacing** also defines `20`, `32`, `44` (safe top), etc.

### 4.2 Usage pattern

`Spacing.lg` (16) and `Spacing.md` (12) are the **most common** in `Screen` defaults and cards. Some layouts use **raw numbers** (`gap: 8`, `padding: 20`, `marginBottom: 2`) alongside tokens — **mixed discipline**.

### 4.3 Border radius (`Radius` in `constants/theme.ts`)

| Token | px |
|-------|-----|
| `xs` | 6 |
| `sm` | 12 |
| `md` | 14 |
| `lg` | 16 |
| `xl` | 20 |
| `full` | 9999 |

**Also in the wild:** `2`, `4`, `7`, `8`, `9`, `10`, `12`, `14`, `18`, `20`, `22`, `24`, `28`, `999` (full pill) — chips, FABs, chat bubbles, map UI. **Not fully normalized** on `Radius` alone.

---

## 5. Visual assets

### 5.1 `assets/` tree (this checkout)

- **`assets/fonts/README.md`** — Documents intended Barlow Condensed / Rajdhani TTFs; **no `.ttf` files** present.
- **`assets/branding/README.md`** — States logo assets removed; use `PlayRatePlaceholder`.
- **`assets/archive/brand-old/`** — `BRAND_SETUP.md`, `BRAND_USAGE.md` (historical).

**No committed `png` / `jpg` / `svg` / `webp` / `ttf` files** were found under `athlete-app` via glob. `explore.tsx` still references `@/assets/images/react-logo.png` — that path may be **missing** unless added locally.

### 5.2 Icon library

- **iOS:** `expo-symbols` (SF Symbols) via `SymbolView`.
- **Android / web:** `@expo/vector-icons` **MaterialIcons** with a static **name mapping** in `icon-symbol.tsx`.

### 5.3 Logo / brand mark

- **No vector/image logo** in repo per branding README.
- **In-app “wordmark”:** `PlayRatePlaceholder` — text “PlayRate” + tagline *“Find runs. Get rated. Level up.”* using theme text colors and custom `fontSize`/`fontWeight` (not the commented custom fonts).

---

## 6. Screen inventory (`app/`) — styling approach

Legend: **Theme** = uses `useThemeColors()` and/or children that do. **SS** = `StyleSheet`. **Designed** = cohesive cards/headers/spacing; **Default** = template or minimal.

| Route / screen | Theme colors | Style approach | Notes |
|----------------|--------------|----------------|--------|
| `index.tsx` | Via `LoadingScreen` | Minimal | Redirect gate |
| `_layout.tsx` | Nav themes + StatusBar | Config | Hex duplicated for React Navigation |
| `(tabs)/_layout.tsx` | Yes | Tabs options | Tab tint from theme |
| `(tabs)/index.tsx` | Yes | SS + shared components | Home — designed |
| `(tabs)/highlights/*` | Yes | SS + shared | Feed, create, detail, comments, send-dm |
| `(tabs)/courts/*` | Yes | SS + shared | Index, detail, new, find, edit, run, send-dm |
| `(tabs)/athletes/index.tsx` | (re-export) | — | Athletes list |
| `(tabs)/profile/*` | Yes | SS + shared | Profile, account, highlights |
| `(tabs)/explore.tsx` | Partial (`Themed*`) | Expo template | **Default starter** feel |
| `sign-in` / `sign-up` | Yes | SS + `KeyboardScreen` | Designed |
| `forgot-password` / `reset-password` | Yes | SS | Designed |
| `profile.tsx` (legacy stack) | Yes | SS | Long form profile |
| `my-sports.tsx` | Indirect (Screen/Header/Card) | SS | Uses `Spacing`, children themed |
| `self-ratings.tsx` | Yes | SS | Designed |
| `profiles.tsx` | Re-exports `components/profiles` | — | Athletes directory |
| `athletes/[userId]/*` | Yes | SS | Profile, followers, following, highlights |
| `inbox.tsx` / `chat/*` | Yes | SS | Some hardcoded white for badges |
| `runs/[id]/recap.tsx` | Yes | SS | Cosign/recap |
| `auth/callback.tsx` | Yes | Minimal | OAuth handling |
| `modal.tsx` | Yes | Light | Simple modal |
| `test-connection.tsx` | No (dev) | connection-test | Hardcoded |

**Layouts** (`*_layout.tsx`): mostly `Stack`/`Slot` config, little visual code.

---

## 7. Brand identity

- **Name:** PlayRate (see `PlayRatePlaceholder`, app config, docs).
- **Documented direction:** `constants/theme.ts` header comment (2K + minimal, `#0000FF` primary, cyan glow + gold tier accents).
- **Additional docs:** `assets/branding/README.md`, `assets/fonts/README.md`, `assets/archive/brand-old/*.md`.
- **`components/brand/index.ts`:** **Empty export** — comment states logo components were removed; use `PlayRatePlaceholder` instead.

---

## Summary gaps (for a future “real” design system)

1. **Navigation dark theme** hex values **≠** `DarkColors` for card/border — consider aligning.
2. **Hardcoded** reds, blacks, whites, and **tier** colors sit outside `theme-context`.
3. **Typography** has a good base scale but **many ad-hoc sizes** (8–15px range) on chat, pills, and comments.
4. **Radius** scale exists but **FABs and chips** use custom numbers.
5. **No packaged fonts** in repo; **no image logo**; Explore tab still **template-styled** and hidden from tab bar (`href: null`).
