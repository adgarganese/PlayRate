import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { LightColors, DarkColors, AccentColors, PRIMARY, brandBlueDark, brandBlueTextDark } from '@/constants/theme';

type ColorScheme = 'light' | 'dark';

type ThemeColors = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceSoft: string;
  surfaceRaised: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textOnPrimary: string;
  primary: string;
  primarySmallText: string;
  cyanGlow: string;
  goldTier: string;
  gold: string;
  goldSoft: string;
  success: string;
  successSoft: string;
  accentPink: string;
  accentElectric: string;
  accentOrange: string;
  background: string;
  card: string;
  textPrimary: string;
};

type ThemeContextType = {
  colors: ThemeColors;
  colorScheme: ColorScheme;
  isDark: boolean;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const systemColorScheme = useColorScheme();
  const colorScheme: ColorScheme = systemColorScheme ?? 'light';
  const isDark = colorScheme === 'dark';

  const colors = useMemo((): ThemeColors => ({
    bg: isDark ? DarkColors.bg : LightColors.bg,
    surface: isDark ? DarkColors.surface : LightColors.surface,
    surfaceAlt: isDark ? DarkColors.surfaceAlt : LightColors.surfaceAlt,
    surfaceSoft: isDark ? DarkColors.surfaceSoft : LightColors.surfaceSoft,
    surfaceRaised: isDark ? DarkColors.surfaceRaised : LightColors.surfaceAlt,
    surfaceElevated: isDark ? DarkColors.surfaceElevated : LightColors.surfaceElevated,
    border: isDark ? DarkColors.border : LightColors.border,
    text: isDark ? DarkColors.text : LightColors.text,
    textMuted: isDark ? DarkColors.textMuted : LightColors.textMuted,
    textOnPrimary: isDark ? DarkColors.textOnPrimary : LightColors.textOnPrimary,
    primary: isDark ? brandBlueDark : PRIMARY,
    primarySmallText: isDark ? brandBlueTextDark : PRIMARY,
    cyanGlow: AccentColors.cyanGlow,
    goldTier: AccentColors.goldTier,
    gold: AccentColors.goldTier,
    goldSoft: AccentColors.goldSoft,
    success: AccentColors.success,
    successSoft: AccentColors.successSoft,
    accentPink: AccentColors.accentPink,
    accentElectric: AccentColors.accentElectric,
    accentOrange: AccentColors.accentOrange,
    background: isDark ? DarkColors.background : LightColors.background,
    card: isDark ? DarkColors.card : LightColors.card,
    textPrimary: isDark ? DarkColors.textPrimary : LightColors.textPrimary,
  }), [isDark]);

  const themeValue = useMemo(
    () => ({ colors, colorScheme, isDark }),
    [colors, colorScheme, isDark]
  );

  return (
    <ThemeContext.Provider value={themeValue}>
      {children}
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme colors based on current color scheme (light/dark)
 * 
 * @example
 * const { colors } = useThemeColors();
 * <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} />
 */
export function useThemeColors(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeColors must be used within a ThemeProvider');
  }
  return context;
}
