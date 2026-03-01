# Logo Assets Analysis

## SVG Components (Already Using Theme Tokens ✓)

All SVG logo components are already using theme tokens and don't need updates:

1. **`components/brand/GotGameWordmark.tsx`**
   - Uses: `colors.text` for "GotGame" text
   - Uses: `AccentColors.goldTier` for "?" question mark
   - ✓ Already using theme tokens

2. **`components/brand/AppIcon.tsx`**
   - Uses: `PRIMARY` for background (#0000FF)
   - Uses: `#FFFFFF` for "GG" text (hardcoded white - OK for icon)
   - Uses: `AccentColors.goldTier` for "?" question mark
   - ✓ Already using theme tokens (white is intentional for icon)

3. **`components/brand/GotGameLogo.tsx`**
   - Uses: `GotGameWordmark` (which uses theme tokens)
   - Uses: `colors.textMuted` for tagline
   - ✓ Already using theme tokens

4. **`components/brand/GotGameLogoText.tsx`**
   - Uses: `colors.text` for "GotGame" text
   - Uses: `AccentColors.goldTier` for "?" question mark
   - Uses: `colors.textMuted` for tagline
   - ✓ Already using theme tokens

**No SVG updates needed** - all components properly use theme tokens.

## PNG Files (Need Re-export from Figma)

The following PNG files are used for app icons, splash screens, and web assets. They need to be re-exported from Figma with the correct brand colors and sizes.

### App Icons

1. **`assets/images/icon.png`**
   - **Usage:** iOS App Icon (`app.json` line 7)
   - **Location:** `app.json` → `expo.icon`
   - **Required Size:** 1024x1024px
   - **Background:** PRIMARY (#0000FF - Primary Blue)
   - **Content:** "GG" text in white + small "?" in gold tier color
   - **Format:** PNG
   - **Notes:** Should match `AppIcon` component design

2. **`assets/images/android-icon-foreground.png`**
   - **Usage:** Android Adaptive Icon Foreground (`app.json` line 21)
   - **Location:** `app.json` → `android.adaptiveIcon.foregroundImage`
   - **Required Size:** 1024x1024px (safe area: inner 66% = 676x676px)
   - **Background:** Transparent
   - **Content:** "GG" text + "?" question mark (same as iOS icon)
   - **Format:** PNG with transparency
   - **Notes:** Foreground should fit within safe area (center 66%)

3. **`assets/images/android-icon-background.png`**
   - **Usage:** Android Adaptive Icon Background (`app.json` line 22)
   - **Location:** `app.json` → `android.adaptiveIcon.backgroundImage`
   - **Required Size:** 1024x1024px
   - **Background:** PRIMARY (#0000FF - Primary Blue)
   - **Content:** Solid color background only
   - **Format:** PNG
   - **Notes:** Can be a simple solid color square

4. **`assets/images/android-icon-monochrome.png`**
   - **Usage:** Android Adaptive Icon Monochrome (`app.json` line 23)
   - **Location:** `app.json` → `android.adaptiveIcon.monochromeImage`
   - **Required Size:** 1024x1024px
   - **Background:** Transparent or white
   - **Content:** Single-color version (for Android 13+ themed icons)
   - **Format:** PNG with transparency
   - **Notes:** Monochrome version that adapts to system theme

### Splash Screen

5. **`assets/images/splash-icon.png`**
   - **Usage:** Splash Screen Icon (`app.json` line 48)
   - **Location:** `app.json` → `plugins[expo-splash-screen].image`
   - **Size:** 200px width (defined in `app.json`)
   - **Aspect Ratio:** Maintain aspect ratio
   - **Background:** Transparent
   - **Content:** "GotGame?" logo/wordmark
   - **Format:** PNG with transparency
   - **Notes:** 
     - Resize mode: `contain` (defined in app.json)
     - Light mode background: `#EEF1F5` (LightColors.bg)
     - Dark mode background: `#0B0F1A` (DarkColors.bg)

### Web Assets

6. **`assets/images/favicon.png`**
   - **Usage:** Web Favicon (`app.json` line 35)
   - **Location:** `app.json` → `web.favicon`
   - **Required Size:** 32x32px or 48x48px (multiple sizes recommended)
   - **Background:** PRIMARY (#0000FF) or transparent
   - **Content:** Simplified "GG" or full "GotGame?" logo
   - **Format:** PNG
   - **Notes:** Small size, needs to be recognizable at 16x16px

## Design Specifications

All app icons should follow the `AppIcon` component design:
- **Background Color:** PRIMARY (#0000FF - Primary Blue)
- **Main Text:** "GG" in white, bold italic
- **Accent:** Small "?" in gold tier (#E7C66A)
- **Border Radius:** Rounded square (approximately 180px on 1024px icon)

## Export Checklist from Figma

1. ✓ **icon.png** - 1024x1024px, iOS app icon
2. ✓ **android-icon-foreground.png** - 1024x1024px, transparent, safe area 676x676px
3. ✓ **android-icon-background.png** - 1024x1024px, solid PRIMARY color
4. ✓ **android-icon-monochrome.png** - 1024x1024px, monochrome/transparent
5. ✓ **splash-icon.png** - 200px width (or larger), transparent, maintain aspect ratio
6. ✓ **favicon.png** - 32x32px (or multiple sizes), web favicon

## Where They're Used

| File | Usage | Configuration Location |
|------|-------|----------------------|
| `icon.png` | iOS App Icon | `app.json` → `expo.icon` |
| `android-icon-foreground.png` | Android Adaptive Icon (foreground) | `app.json` → `android.adaptiveIcon.foregroundImage` |
| `android-icon-background.png` | Android Adaptive Icon (background) | `app.json` → `android.adaptiveIcon.backgroundImage` |
| `android-icon-monochrome.png` | Android Adaptive Icon (monochrome) | `app.json` → `android.adaptiveIcon.monochromeImage` |
| `splash-icon.png` | Splash Screen Icon | `app.json` → `plugins[expo-splash-screen].image` |
| `favicon.png` | Web Favicon | `app.json` → `web.favicon` |

## Additional Notes

- The `AppIcon` component (`components/brand/AppIcon.tsx`) is a programmatic SVG version that can be used as a reference for the design
- All logos use the PRIMARY color (#0000FF) as the background
- The gold tier accent (#E7C66A) is used for the question mark
- Header logos are handled by `GotGameLogoText` component (text-based, no image file needed)
