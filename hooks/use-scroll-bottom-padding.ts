import { useContext } from 'react';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Spacing } from '@/constants/theme';

/** Space below the last scroll row so content clears the tab bar / home indicator comfortably */
const SCROLL_END_GUTTER = 10;

/** Extra `paddingBottom` for lists with a floating FAB above the tab bar (~diameter + margin) */
export const SCROLL_EXTRA_FOR_FLOATING_FAB = 56 + Spacing.lg;

function useTabBarHeightOrZero(): number {
  const h = useContext(BottomTabBarHeightContext);
  return typeof h === 'number' && h > 0 ? h : 0;
}

export type ScrollContentBottomMode = 'default' | 'modal';

/**
 * `contentContainerStyle.paddingBottom` for vertical ScrollView / FlatList / SectionList.
 *
 * - **default:** Under the bottom tab navigator → measured tab bar height (includes home indicator) + gutter.
 *   Outside tabs (modals, root stack, onboarding) → safe-area bottom + comfortable minimum.
 * - **modal:** Full-screen overlay (Modal) — ignores tab bar height so padding matches the visible sheet, not the obscured tab bar.
 */
export function useScrollContentBottomPadding(mode: ScrollContentBottomMode = 'default'): number {
  const insets = useSafeAreaInsets();
  // Always read tab bar height (hooks must not run after conditional returns).
  const tabH = useTabBarHeightOrZero();

  if (mode === 'modal') {
    return Math.max(insets.bottom, Spacing.md) + Spacing.lg + SCROLL_END_GUTTER;
  }

  if (tabH > 0) {
    return tabH + SCROLL_END_GUTTER;
  }

  return Math.max(insets.bottom, Spacing.md) + Spacing.lg + SCROLL_END_GUTTER;
}

/**
 * Bottom inset for FABs and fixed footers on tab screens: max(tab bar height, safe bottom) + extra.
 * Safe outside the tab navigator (falls back to safe area + extra).
 */
export function useTabBarSafeBottom(extra = 0): number {
  const insets = useSafeAreaInsets();
  const tabH = useTabBarHeightOrZero();
  const base = tabH > 0 ? Math.max(tabH, insets.bottom) : Math.max(insets.bottom, Spacing.md) + Spacing.sm;
  return base + extra;
}
