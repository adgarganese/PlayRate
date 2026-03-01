/**
 * PlayRate Design System
 * Single source of truth for colors, spacing, typography, and radius
 * 
 * Style: 50% "2K energy" + 50% sleek/minimal
 * High contrast, subtle glow, premium accents used sparingly
 */

import { Platform, TextStyle } from 'react-native';

// ============================================================================
// PRIMARY BLUE – single source of truth (exactly #0000FF everywhere used as primary)
// ============================================================================
export const PRIMARY = '#0000FF' as const;

/** Brand blue – same as PRIMARY. Use for headings, buttons, icons. */
export const brandBlue = PRIMARY;

/**
 * Dark mode blue override for buttons, icons, and blue text.
 * Light mode uses brandBlue (#0000FF); dark mode uses this (#38BDF8).
 */
export const brandBlueDark = '#38BDF8' as const;

/**
 * Lighter blue for small text on dark backgrounds (captions, helper text, links).
 * Use only in dark mode for readability; light mode keeps brandBlue.
 * Option A: #7B9EFF (balanced). Option B: #9BADFF (higher contrast).
 */
export const brandBlueTextDark = '#7B9EFF' as const;

// ============================================================================
// COLOR TOKENS - Light Mode
// ============================================================================
export const LightColors = {
  // Primary blue (must match PRIMARY)
  primary: PRIMARY,

  // Backgrounds
  bg: '#EEF1F5',           // Light grey background
  surface: '#FFFFFF',       // Card/surface background
  surfaceAlt: '#F7F8FB',    // Alternative surface (subtle variation)
  surfaceSoft: '#EEF1F5',   // Soft grey for large page backgrounds
  surfaceRaised: '#FFFFFF', // Raised surface for featured cards
  surfaceElevated: '#FFFFFF', // Elevated surface (same as surface in light; used for depth in dark)
  
  // Borders
  border: '#D8DEE9',        // Subtle border color
  
  // Text
  text: '#0B1020',          // Primary text (dark)
  textMuted: '#5B657A',     // Muted/secondary text
  textOnPrimary: '#FFFFFF', // Text on primary color background (white)
  
  // Legacy support (for backward compatibility during migration)
  background: '#EEF1F5',
  card: '#FFFFFF',
  textPrimary: '#0B1020',
} as const;

// ============================================================================
// COLOR TOKENS - Dark Mode
// ============================================================================
export const DarkColors = {
  // Backgrounds (lightened for better contrast with #0000FF primary)
  bg: '#070A10',            // Near-black app background (dark mode only)
  surface: '#1A2238',       // Card/surface background (lightened from #12182A)
  surfaceAlt: '#1F2A42',    // Alternative surface (lightened from #161F35)
  surfaceSoft: '#171C2A',   // Soft grey for large page backgrounds (lightened from #0F1523)
  surfaceRaised: '#232B42', // Raised grey for featured/important cards (lightened from #1A2238)
  surfaceElevated: '#1E2640', // Slightly lighter than surface for depth (key containers only)
  
  // Borders (brightened for better separation)
  border: '#2A3A54',        // Border color (brightened from #24304A for better visibility)
  
  // Text (maintained high contrast, textMuted brightened slightly)
  text: '#F4F7FF',          // Primary text (light) - unchanged
  textMuted: '#B8C4D8',     // Muted/secondary text (brightened from #AAB3C8 for better readability)
  textOnPrimary: '#FFFFFF', // Text on primary color background (white)
  
  // Legacy support (for backward compatibility during migration)
  background: '#070A10',
  card: '#1A2238',
  textPrimary: '#F4F7FF',
} as const;

// ============================================================================
// ACCENT COLORS (Theme-agnostic)
// ============================================================================
export const AccentColors = {
  primary: PRIMARY,         // Pure blue - main brand color (#0000FF)
  cyanGlow: '#00E5FF',      // Cyan glow - use sparingly for selected state/glow
  goldTier: '#E7C666',      // Gold tier - use ONLY for tier/premium highlights (crown, badges, featured)
  goldSoft: '#F5E8C7',      // Soft gold - lighter tint for subtle highlights (borders, backgrounds)
  success: '#22C55E',       // Success green - confirmations, success states
  successSoft: '#DCFCE7',   // Soft success - light tint for backgrounds/borders (or use success + opacity)
} as const;

/** Single gold color for logo/favorite/check-in; use this instead of hardcoding hex. */
export const GOLD = AccentColors.goldTier;

// ============================================================================
// LEGACY COLORS (for backward compatibility - will be removed after migration)
// ============================================================================
export const PlayRateColors = {
  background: '#0A0A0A',
  card: '#1A1A1A',
  textPrimary: '#FFFFFF',
  textMuted: '#999999',
  accent: '#FFD700',
  brandGold: '#D6A73B',
  border: '#2A2A2A',
} as const;

// Legacy color support (for backward compatibility)
const tintColorLight = PRIMARY;
const tintColorDark = PRIMARY;

export const Colors = {
  light: {
    text: LightColors.text,
    background: LightColors.bg,
    tint: tintColorLight,
    icon: LightColors.textMuted,
    tabIconDefault: LightColors.textMuted,
    tabIconSelected: PRIMARY,
  },
  dark: {
    text: DarkColors.text,
    background: DarkColors.bg,
    tint: tintColorDark,
    icon: DarkColors.textMuted,
    tabIconDefault: DarkColors.textMuted,
    tabIconSelected: PRIMARY,
  },
} as const;

// ============================================================================
// SPACING SCALE
// ============================================================================
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

// ============================================================================
// RADIUS (Sleek, consistent rounded corners)
// ============================================================================
export const Radius = {
  xs: 6,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================
export const Typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as TextStyle['fontWeight'],
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as TextStyle['fontWeight'],
    lineHeight: 32,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  muted: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  mutedSmall: {
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
  },
} as const;

// ============================================================================
// SHADOWS (Platform-specific)
// ============================================================================
export const Shadows = {
  light: {
    card: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
    elevated: Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
  dark: {
    card: Platform.select({
      ios: {
        shadowColor: AccentColors.cyanGlow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      default: {},
    }),
    elevated: Platform.select({
      ios: {
        shadowColor: AccentColors.cyanGlow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
      default: {},
    }),
  },
} as const;

// ============================================================================
// FONTS (Platform-specific)
// ============================================================================
export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ============================================================================
// LEGACY SPACING (for backward compatibility)
// ============================================================================
export const LegacySpacing = {
  safeAreaTop: Platform.select({
    ios: 44,
    android: 24,
    default: 24,
  }),
  content: 20,
  section: 32,
  item: 16,
  small: 8,
  medium: 12,
  large: 24,
} as const;
