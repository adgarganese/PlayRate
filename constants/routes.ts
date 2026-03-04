/**
 * Centralized route paths for navigation.
 * Use these so Home "Find Athletes" and Athletes tab stay in sync.
 *
 * Test plan (iPhone): From Home, tap "Find Athletes" or "Discover Players" → should land on same screen as Athletes tab, no double header, back behaves like tab switch.
 */

/** Route for the Athletes tab (list). Same as tapping the Athletes tab. */
export const ATHLETES_TAB_ROUTE = '/(tabs)/athletes';
