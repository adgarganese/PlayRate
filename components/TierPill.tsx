import { StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getTierInfo, type Tier } from '@/lib/tiers';

type TierPillProps = {
  tier: Tier;
  size?: 'small' | 'medium' | 'large';
};

const TIER_PILL_SIZE_STYLES = {
  small: { paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, borderRadius: 8 },
  medium: { paddingHorizontal: 12, paddingVertical: 6, fontSize: 13, borderRadius: 10 },
  large: { paddingHorizontal: 16, paddingVertical: 8, fontSize: 15, borderRadius: 12 },
} as const;

export function TierPill({ tier, size = 'medium' }: TierPillProps) {
  const colorScheme = useColorScheme();
  const tierInfo = getTierInfo(tier);
  const isDark = colorScheme === 'dark';
  const currentSize = TIER_PILL_SIZE_STYLES[size];

  return (
    <ThemedView
      style={[
        styles.pill,
        {
          backgroundColor: isDark
            ? `${tierInfo.darkColor}30`
            : `${tierInfo.color}20`,
          borderColor: isDark ? tierInfo.darkColor : tierInfo.color,
          ...currentSize,
        },
      ]}
    >
      <ThemedText
        style={[
          styles.text,
          {
            color: isDark ? tierInfo.darkColor : tierInfo.color,
            fontSize: currentSize.fontSize,
            fontWeight: '600',
          },
        ]}
      >
        {tierInfo.name}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '600',
  },
});
