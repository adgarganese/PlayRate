import * as Font from 'expo-font';

/**
 * Load custom fonts for PlayRate brand
 * Returns true if fonts loaded successfully, false otherwise
 */
export async function loadBrandFonts(): Promise<boolean> {
  try {
    await Font.loadAsync({
      // Barlow Condensed ExtraBold Italic - for main wordmark
      'BarlowCondensed-ExtraBoldItalic': require('@/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
      
      // Rajdhani Medium - for tagline
      'Rajdhani-Medium': require('@/assets/fonts/Rajdhani-Medium.ttf'),
      
      // Fallbacks if exact weights/styles aren't available
      'BarlowCondensed-Bold': require('@/assets/fonts/BarlowCondensed-Bold.ttf'),
      'Rajdhani-Regular': require('@/assets/fonts/Rajdhani-Regular.ttf'),
    });
    
    return true;
  } catch (error) {
    if (__DEV__) console.warn('[fonts] Failed to load custom fonts. Using system fallbacks:', error);
    return false;
  }
}

/**
 * Check if custom fonts are loaded
 */
export function areBrandFontsLoaded(): boolean {
  try {
    // Check if at least one font is loaded
    return Font.isLoaded('BarlowCondensed-ExtraBoldItalic') || 
           Font.isLoaded('BarlowCondensed-Bold') ||
           Font.isLoaded('Rajdhani-Medium');
  } catch (error) {
    if (__DEV__) console.warn('[fonts:areBrandFontsLoaded]', error);
    return false;
  }
}
