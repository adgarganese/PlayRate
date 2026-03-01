/**
 * Tier system based on cosigns received
 * 
 * Tiers:
 * - Rookie: 0-4 cosigns
 * - Proven: 5-14 cosigns
 * - Hooper: 15-39 cosigns
 * - Certified: 40-99 cosigns
 * - Elite: 100+ cosigns
 */

export type Tier = 'Rookie' | 'Proven' | 'Hooper' | 'Certified' | 'Elite';

export interface TierInfo {
  name: Tier;
  minCosigns: number;
  maxCosigns: number | null; // null means no upper limit
  color: string;
  darkColor: string;
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  Rookie: {
    name: 'Rookie',
    minCosigns: 0,
    maxCosigns: 4,
    color: '#9CA3AF', // gray
    darkColor: '#6B7280',
  },
  Proven: {
    name: 'Proven',
    minCosigns: 5,
    maxCosigns: 14,
    color: '#3B82F6', // blue
    darkColor: '#2563EB',
  },
  Hooper: {
    name: 'Hooper',
    minCosigns: 15,
    maxCosigns: 39,
    color: '#10B981', // green
    darkColor: '#059669',
  },
  Certified: {
    name: 'Certified',
    minCosigns: 40,
    maxCosigns: 99,
    color: '#F59E0B', // amber
    darkColor: '#D97706',
  },
  Elite: {
    name: 'Elite',
    minCosigns: 100,
    maxCosigns: null,
    color: '#8B5CF6', // purple
    darkColor: '#7C3AED',
  },
};

/**
 * Get tier from cosign count
 * This matches the database function get_tier_from_cosigns
 */
export function getTierFromCosigns(count: number): Tier {
  if (count >= 100) return 'Elite';
  if (count >= 40) return 'Certified';
  if (count >= 15) return 'Hooper';
  if (count >= 5) return 'Proven';
  return 'Rookie';
}

/**
 * Get tier info object from tier name
 */
export function getTierInfo(tier: Tier): TierInfo {
  return TIER_INFO[tier];
}

/**
 * Get tier info from cosign count
 */
export function getTierInfoFromCosigns(count: number): TierInfo {
  const tier = getTierFromCosigns(count);
  return TIER_INFO[tier];
}
