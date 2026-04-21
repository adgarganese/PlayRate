import { View, Text, StyleSheet } from 'react-native';
import {
  COSIGN_TIER_LIST,
  getTierForCosignCount,
  normalizeCosignTierName,
  type CosignTierName,
} from '@/lib/tiers';

const TIER_LETTER: Record<CosignTierName, string> = {
  Unranked: '',
  Bronze: 'B',
  Silver: 'S',
  Gold: 'G',
  Platinum: 'P',
  Diamond: 'D',
};

const SIZES = {
  sm: { dim: 17, font: 9, radius: 5 },
  md: { dim: 24, font: 12, radius: 7 },
} as const;

export type TierBadgeSize = keyof typeof SIZES;

export type TierBadgeProps = {
  /** Stored `profiles.rep_level` / rollup tier string */
  tierName?: string | null;
  /** When set without tierName, tier is derived from count */
  cosignCount90Days?: number;
  size?: TierBadgeSize;
};

function tierDefByName(name: CosignTierName) {
  return COSIGN_TIER_LIST.find((t) => t.name === name) ?? COSIGN_TIER_LIST[0];
}

/**
 * Inline reputation badge (hidden for Unranked).
 */
export function TierBadge({ tierName, cosignCount90Days, size = 'sm' }: TierBadgeProps) {
  const hasTierName = tierName !== undefined && tierName !== null && String(tierName).trim() !== '';
  const resolved: CosignTierName = hasTierName
    ? normalizeCosignTierName(tierName)
    : cosignCount90Days !== undefined
      ? getTierForCosignCount(cosignCount90Days).name
      : 'Unranked';

  if (resolved === 'Unranked') return null;

  const def = tierDefByName(resolved);
  const letter = TIER_LETTER[resolved];
  const s = SIZES[size];

  return (
    <View
      style={[
        styles.badge,
        {
          width: s.dim,
          height: s.dim,
          borderRadius: s.radius,
          borderColor: def.color,
          backgroundColor: `${def.color}22`,
        },
      ]}
      accessibilityLabel={`${def.name} tier`}
    >
      <Text style={[styles.letter, { color: def.color, fontSize: s.font, lineHeight: s.font + 2 }]}>
        {letter}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  letter: {
    fontWeight: '800',
    textAlign: 'center',
  },
});
