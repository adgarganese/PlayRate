# GotGame? Brand Components Usage Guide

## Components Created

### 1. `GotGameWordmark`
The main "GotGame?" wordmark with white text and gold question mark.

```tsx
import { GotGameWordmark } from '@/components/brand';

<GotGameWordmark width={200} height={60} fontSize={48} />
```

**Props:**
- `width?: number` - SVG width (default: 200)
- `height?: number` - SVG height (default: 60)
- `fontSize?: number` - Font size for "GotGame" text (default: 48)

### 2. `GotGameLogo`
Complete brand lockup with wordmark and tagline.

```tsx
import { GotGameLogo } from '@/components/brand';

<GotGameLogo 
  width={200} 
  showTagline={true}
  tagline="Find runs. Get rated. Level up."
/>
```

**Props:**
- `width?: number` - SVG width (default: 200)
- `showTagline?: boolean` - Show tagline below wordmark (default: true)
- `tagline?: string` - Custom tagline text (default: "Find runs. Get rated. Level up.")
- `style?: ViewStyle` - Additional styling

### 3. `AppIcon`
App icon with "GG" in rounded square with gold question mark.

```tsx
import { AppIcon } from '@/components/brand';

<AppIcon size={1024} borderRadius={180} />
```

**Props:**
- `size?: number` - Icon size in pixels (default: 1024, for export use 1024)
- `borderRadius?: number` - Corner radius for rounded square (default: 180)

## Font Setup

### Required Fonts
1. **Barlow Condensed ExtraBold Italic** - Main wordmark
2. **Rajdhani Medium** - Tagline

### Installation
1. Download fonts from Google Fonts:
   - [Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed) - ExtraBold 800, Italic
   - [Rajdhani](https://fonts.google.com/specimen/Rajdhani) - Medium 500

2. Place `.ttf` files in `assets/fonts/`:
   - `BarlowCondensed-ExtraBoldItalic.ttf`
   - `Rajdhani-Medium.ttf`

3. Uncomment font loading in `app/_layout.tsx`

### Fallback Fonts
Components work without custom fonts using system fallbacks:
- **Barlow Condensed** → Arial Black, Arial
- **Rajdhani** → Arial, sans-serif

## Colors Used
- **White**: `#FFFFFF` - Main text
- **Brand Gold**: `#D6A73B` - Question mark accent
- **Muted Gray**: `#999999` - Tagline text
- **Dark Background**: `#0A0A0A` - App icon background

## Example: Update Home Screen Header

Replace the text header with the brand logo:

```tsx
import { GotGameLogo } from '@/components/brand';

// In your Header component or directly:
<GotGameLogo width={180} showTagline={true} />
```

## Exporting App Icon

To generate app icon PNG files from SVG:

1. Use the `AppIcon` component at 1024x1024
2. Render in a standalone component
3. Use a tool like `react-native-view-shot` to capture as PNG
4. Or manually export from Figma/Sketch using the SVG specs

## Design Specs

- **Wordmark**: Barlow Condensed ExtraBold Italic, white, gold question mark
- **Tagline**: Rajdhani Medium, muted gray
- **Icon**: Rounded square (border radius 180/1024 ≈ 17.6%), dark background
- **Question mark**: Gold (#D6A73B), positioned top-right in icon
