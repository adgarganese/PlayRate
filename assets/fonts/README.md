# Custom Fonts for PlayRate Brand

This directory should contain the following font files:

## Required Fonts

1. **Barlow Condensed ExtraBold Italic**
   - File: `BarlowCondensed-ExtraBoldItalic.ttf`
   - Used for: Main PlayRate wordmark and app icon
   - Source: [Google Fonts - Barlow Condensed](https://fonts.google.com/specimen/Barlow+Condensed)
   - Download: ExtraBold 800 weight, Italic style

2. **Rajdhani Medium**
   - File: `Rajdhani-Medium.ttf`
   - Used for: Tagline text ("Find runs. Get rated. Level up.")
   - Source: [Google Fonts - Rajdhani](https://fonts.google.com/specimen/Rajdhani)
   - Download: Medium 500 weight

## Installation Steps

1. Download the fonts from Google Fonts
2. Place the `.ttf` files in this directory (`assets/fonts/`)
3. Update `app/_layout.tsx` to load the fonts (see font loading code)
4. The SVG components will automatically use these fonts with system font fallbacks

## Fallback Fonts

The components are designed to work even if the custom fonts aren't loaded. They will fall back to:
- **Barlow Condensed fallback**: Arial Black, Arial
- **Rajdhani fallback**: Arial, sans-serif
