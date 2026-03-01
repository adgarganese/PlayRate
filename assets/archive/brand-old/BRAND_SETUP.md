# GotGame? Brand Setup Instructions

## ✅ What's Been Created

1. **GotGameWordmark** - Main "GotGame?" wordmark component
2. **GotGameLogo** - Complete brand lockup (wordmark + tagline)
3. **AppIcon** - App icon with "GG" in rounded square
4. **Brand Colors** - Added `brandGold: '#D6A73B'` to theme
5. **react-native-svg** - Installed for crisp SVG rendering

## 📝 Next Steps: Add Custom Fonts

### Step 1: Download Fonts from Google Fonts

1. **Barlow Condensed ExtraBold Italic** (800 weight, Italic style)
   - Visit: https://fonts.google.com/specimen/Barlow+Condensed
   - Click "Select this style" → ExtraBold 800, Italic
   - Download the family
   - Extract `BarlowCondensed-ExtraBoldItalic.ttf`

2. **Rajdhani Medium** (500 weight)
   - Visit: https://fonts.google.com/specimen/Rajdhani
   - Click "Select this style" → Medium 500
   - Download the family
   - Extract `Rajdhani-Medium.ttf`

### Step 2: Add Fonts to Project

1. Create `assets/fonts/` directory if it doesn't exist
2. Copy font files:
   - `BarlowCondensed-ExtraBoldItalic.ttf` → `assets/fonts/`
   - `Rajdhani-Medium.ttf` → `assets/fonts/`

### Step 3: Enable Font Loading

1. Open `app/_layout.tsx`
2. Uncomment the font loading lines (around line 125-128):

```tsx
const [fontsLoaded] = useFonts({
  'BarlowCondensed-ExtraBoldItalic': require('@/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
  'BarlowCondensed-Bold': require('@/assets/fonts/BarlowCondensed-Bold.ttf'), // Optional fallback
  'Rajdhani-Medium': require('@/assets/fonts/Rajdhani-Medium.ttf'),
  'Rajdhani-Regular': require('@/assets/fonts/Rajdhani-Regular.ttf'), // Optional fallback
});
```

## 🎨 Design Specs

### Colors
- **White**: `#FFFFFF` - Main text
- **Brand Gold**: `#D6A73B` - Question mark accent (already in theme)
- **Muted Gray**: `#999999` - Tagline (already in theme)
- **Dark Background**: `#0A0A0A` - App icon background (already in theme)

### Typography
- **Wordmark**: Barlow Condensed ExtraBold Italic, 48px default, white text, gold "?"
- **Tagline**: Rajdhani Medium, 14px default, muted gray

### App Icon
- **Size**: 1024x1024px (for export)
- **Shape**: Rounded square (border radius 180/1024 ≈ 17.6%)
- **Background**: Dark (#0A0A0A)
- **Content**: "GG" in white, gold "?" in top-right

## 📱 Usage Examples

### Home Screen Header
```tsx
import { GotGameLogo } from '@/components/brand';

<GotGameLogo width={180} showTagline={true} />
```

### App Icon Preview
```tsx
import { AppIcon } from '@/components/brand';
import { View } from 'react-native';

<View style={{ width: 64, height: 64 }}>
  <AppIcon size={64} borderRadius={11} />
</View>
```

## ✅ Testing

Components work **immediately** without fonts using system fallbacks:
- Arial Black for wordmark
- Arial for tagline

Once you add the font files and uncomment the loading code, custom fonts will be used automatically.

## 🎯 Export App Icon

To export the app icon as PNG:

1. Render `AppIcon` at 1024x1024
2. Use a screenshot/capture tool
3. Or manually recreate in Figma/Sketch using the same specs

The SVG component can be used directly in React Native and will scale perfectly at any size!
