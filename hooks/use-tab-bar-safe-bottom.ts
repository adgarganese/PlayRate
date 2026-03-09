import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Shared bottom offset for tab-visible screens with bottom-fixed UI.
 * Keeps controls above the tab bar instead of only above the device inset.
 *
 * Use this only inside the tab navigator tree.
 */
export function useTabBarSafeBottom(extra = 0): number {
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  return Math.max(tabBarHeight, insets.bottom) + extra;
}
