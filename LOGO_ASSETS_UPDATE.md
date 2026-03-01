# Logo Assets Update Guide - Primary Blue Theme

## ✅ Updated Components (SVG - No Re-export Needed)

The following React Native SVG components have been updated to use the new Primary Blue palette:

1. **`components/brand/GotGameWordmark.tsx`**
   - "GotGame" text: Uses theme-aware `colors.text` (white in dark mode, dark in light mode)
   - "?" question mark: `#E7C66A` (goldTier accent)

2. **`components/brand/GotGameLogo.tsx`**
   - Wordmark: Theme-aware colors
   - Tagline: Uses theme-aware `colors.textMuted`

3. **`components/brand/AppIcon.tsx`**
   - Background: `#0000FF` (PRIMARY - Primary Blue)
   - "GG" text: `#FFFFFF` (white)
   - "?" question mark: `#E7C66A` (goldTier accent)

4. **`components/brand/GotGameLogoText.tsx`**
   - Already updated in previous theme migration

## 📱 PNG Assets That Need Re-exporting from Figma

The following PNG assets are **flattened images** and need to be re-exported with the new Primary Blue palette:

### 1. App Icon (`assets/images/icon.png`)
**Current**: Generic Expo icon  
**New Specs**:
- **Size**: 1024x1024px
- **Background**: `#0000FF` (Primary Blue)
- **Content**: "GG" in white (`#FFFFFF`), gold "?" (`#E7C66A`) in top-right
- **Shape**: Rounded square (border radius ~17.6%)
- **Format**: PNG with transparency (or solid background)

**Figma Instructions**:
1. Create 1024x1024px artboard
2. Add rounded rectangle (rx: 180, ry: 180)
3. Fill with `#0000FF`
4. Add "GG" text: Barlow Condensed ExtraBold Italic, white, centered
5. Add "?" text: Barlow Condensed ExtraBold Italic, `#E7C66A`, positioned top-right
6. Export as PNG at 1x, 2x, 3x if needed

### 2. Android Adaptive Icon - Foreground (`assets/images/android-icon-foreground.png`)
**Current**: Generic icon  
**New Specs**:
- **Size**: 1024x1024px (safe zone: 432x432px center)
- **Content**: "GG" in white, gold "?" in top-right
- **Background**: Transparent
- **Format**: PNG with transparency

**Figma Instructions**:
1. Create 1024x1024px artboard
2. Add "GG" text: Barlow Condensed ExtraBold Italic, white, centered
3. Add "?" text: Barlow Condensed ExtraBold Italic, `#E7C66A`, positioned top-right
4. Ensure content fits within 432x432px safe zone (center)
5. Export as PNG with transparency

### 3. Android Adaptive Icon - Background (`assets/images/android-icon-background.png`)
**Current**: Light blue background  
**New Specs**:
- **Size**: 1024x1024px
- **Color**: `#0000FF` (Primary Blue)
- **Format**: PNG (solid color, no transparency needed)

**Figma Instructions**:
1. Create 1024x1024px artboard
2. Fill with solid color `#0000FF`
3. Export as PNG

### 4. Android Adaptive Icon - Monochrome (`assets/images/android-icon-monochrome.png`)
**Current**: Generic monochrome icon  
**New Specs**:
- **Size**: 1024x1024px
- **Content**: "GG" in white, "?" in white (or use PRIMARY color)
- **Background**: Transparent
- **Format**: PNG with transparency
- **Note**: Monochrome icons should be single-color (white recommended for dark backgrounds)

**Figma Instructions**:
1. Create 1024x1024px artboard
2. Add "GG" text: Barlow Condensed ExtraBold Italic, white, centered
3. Add "?" text: Barlow Condensed ExtraBold Italic, white, positioned top-right
4. Export as PNG with transparency

### 5. Favicon (`assets/images/favicon.png`)
**Current**: Generic favicon  
**New Specs**:
- **Size**: 32x32px (or 16x16px, 48x48px for multi-resolution)
- **Background**: `#0000FF` (Primary Blue)
- **Content**: "GG" in white, small "?" in gold
- **Format**: PNG or ICO

**Figma Instructions**:
1. Create 32x32px artboard (or multiple sizes: 16x16, 32x32, 48x48)
2. Add rounded rectangle background: `#0000FF`
3. Add "GG" text: Barlow Condensed ExtraBold Italic, white, scaled appropriately
4. Add small "?" text: `#E7C66A`, positioned top-right
5. Export as PNG at multiple sizes

### 6. Splash Screen Icon (`assets/images/splash-icon.png`)
**Current**: Generic splash icon  
**New Specs**:
- **Size**: 200x200px (or larger, will be scaled)
- **Content**: Full "GotGame?" wordmark with tagline
- **Background**: Transparent
- **Format**: PNG with transparency

**Figma Instructions**:
1. Create 200x200px artboard (or 400x400px for @2x)
2. Add "GotGame" text: Barlow Condensed ExtraBold Italic, white, large size
3. Add "?" text: Barlow Condensed ExtraBold Italic, `#E7C66A`, positioned after "GotGame"
4. Add tagline: "Find runs. Get rated. Level up." - Rajdhani Medium, muted gray
5. Export as PNG with transparency

## 🎨 Color Reference

### Primary Colors
- **PRIMARY (Primary Blue)**: `#0000FF` - Main brand color, use for backgrounds
- **Gold Tier**: `#E7C66A` - Use ONLY for question mark accent and tier/premium highlights

### Text Colors (Theme-aware)
- **Light Mode Text**: `#0B1020` (dark)
- **Dark Mode Text**: `#F4F7FF` (light/white)
- **Muted Text**: `#5B657A` (light) / `#AAB3C8` (dark)

### Background Colors
- **Light Mode BG**: `#EEF1F5`
- **Dark Mode BG**: `#0B0F1A`

## ✅ Updated Configuration Files

1. **`app.json`** - Updated:
   - Android adaptiveIcon backgroundColor: `#0000FF` (was `#E6F4FE`)
   - Splash screen backgroundColor: `#EEF1F5` (light) / `#0B0F1A` (dark)

## 📋 Export Checklist

After re-exporting from Figma, replace these files:

- [ ] `assets/images/icon.png` (1024x1024px)
- [ ] `assets/images/android-icon-foreground.png` (1024x1024px, transparent)
- [ ] `assets/images/android-icon-background.png` (1024x1024px, solid `#0000FF`)
- [ ] `assets/images/android-icon-monochrome.png` (1024x1024px, transparent)
- [ ] `assets/images/favicon.png` (32x32px or multi-size)
- [ ] `assets/images/splash-icon.png` (200x200px or 400x400px @2x)

## 🚀 Testing

After replacing assets:

1. **iOS**: Run `npx expo prebuild --clean` to regenerate native projects
2. **Android**: Same as above
3. **Web**: Favicon should update automatically
4. **Splash**: Test in both light and dark mode

## 📝 Notes

- All SVG components are now theme-aware and will automatically adapt to light/dark mode
- PNG assets are static and need manual re-export
- The `AppIcon` component can be used to preview the icon design before exporting
- Consider creating a premium/tier variant with gold background for special editions (optional)
