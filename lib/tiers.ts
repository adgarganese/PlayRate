/**
 * Cosign reputation tiers — 90-day rolling window (counts align with `recompute_rep` / `rep_rollups`).
 */

export type CosignTierName = 'Unranked' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';

export type CosignTierDef = {
  name: CosignTierName;
  minCosigns: number;
  color: string;
};

/** Ordered lowest → highest for progression UI. */
export const COSIGN_TIER_LIST: CosignTierDef[] = [
  { name: 'Unranked', minCosigns: 0, color: '#9CA3AF' },
  { name: 'Bronze', minCosigns: 5, color: '#CD7F32' },
  { name: 'Silver', minCosigns: 15, color: '#C0C0C0' },
  { name: 'Gold', minCosigns: 35, color: '#FFD700' },
  { name: 'Platinum', minCosigns: 75, color: '#E5E4E2' },
  { name: 'Diamond', minCosigns: 150, color: '#B9F2FF' },
];

const TIER_ORDER_RANK: Record<CosignTierName, number> = {
  Unranked: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
  Diamond: 5,
};

/** Normalize DB / legacy values to a known tier name. */
export function normalizeCosignTierName(raw: string | number | null | undefined): CosignTierName {
  if (raw === null || raw === undefined) return 'Unranked';
  const s = String(raw).trim();
  if (s === '') return 'Unranked';
  const lower = s.toLowerCase();
  const byName = COSIGN_TIER_LIST.find((t) => t.name.toLowerCase() === lower);
  if (byName) return byName.name;
  // Legacy numeric rep_level (1–6) from older DB
  const n = parseInt(s, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= 6) {
    const legacy: CosignTierName[] = ['Unranked', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond'];
    return legacy[n - 1] ?? 'Unranked';
  }
  return 'Unranked';
}

/**
 * Tier for a 90-day rolling cosign count (same thresholds as `recompute_rep`).
 */
export function getTierForCosignCount(count: number): CosignTierDef {
  const n = Math.max(0, Math.floor(count));
  let current = COSIGN_TIER_LIST[0];
  for (const t of COSIGN_TIER_LIST) {
    if (n >= t.minCosigns) current = t;
  }
  return current;
}

export function tierRank(name: string | CosignTierName | null | undefined): number {
  const t = normalizeCosignTierName(name);
  return TIER_ORDER_RANK[t] ?? 0;
}

/** Next tier after `name`, or null if already Diamond. */
export function getNextTier(name: CosignTierName): CosignTierDef | null {
  const idx = COSIGN_TIER_LIST.findIndex((t) => t.name === name);
  if (idx < 0 || idx >= COSIGN_TIER_LIST.length - 1) return null;
  return COSIGN_TIER_LIST[idx + 1] ?? null;
}

export type CosignProgressToNext = {
  current: CosignTierDef;
  next: CosignTierDef | null;
  cosignsToNext: number | null;
  /** Human copy e.g. "12 more to reach Gold" */
  progressLabel: string | null;
};

export function getCosignProgressToNextTier(total90DayCosigns: number): CosignProgressToNext {
  const current = getTierForCosignCount(total90DayCosigns);
  const next = getNextTier(current.name);
  if (!next) {
    return {
      current,
      next: null,
      cosignsToNext: null,
      progressLabel: null,
    };
  }
  const needed = Math.max(0, next.minCosigns - total90DayCosigns);
  return {
    current,
    next,
    cosignsToNext: needed,
    progressLabel: needed === 0 ? `You've reached ${next.name}!` : `${needed} more to reach ${next.name}`,
  };
}

// --- Back-compat exports (older API names) ---

/** @deprecated Use `getTierForCosignCount` + `CosignTierName` */
export type Tier = CosignTierName;

export type TierInfo = CosignTierDef & { maxCosigns: number | null; darkColor: string };

function defToTierInfo(d: CosignTierDef, maxCosigns: number | null): TierInfo {
  return {
    ...d,
    maxCosigns,
    darkColor: d.color,
  };
}

/** @deprecated Prefer `COSIGN_TIER_LIST` / `getTierForCosignCount` */
export const TIER_INFO: Record<CosignTierName, TierInfo> = {
  Unranked: defToTierInfo(COSIGN_TIER_LIST[0], 4),
  Bronze: defToTierInfo(COSIGN_TIER_LIST[1], 14),
  Silver: defToTierInfo(COSIGN_TIER_LIST[2], 34),
  Gold: defToTierInfo(COSIGN_TIER_LIST[3], 74),
  Platinum: defToTierInfo(COSIGN_TIER_LIST[4], 149),
  Diamond: defToTierInfo(COSIGN_TIER_LIST[5], null),
};

/** @deprecated Use `getTierForCosignCount` */
export function getTierFromCosigns(count: number): CosignTierName {
  return getTierForCosignCount(count).name;
}

/** @deprecated */
export function getTierInfo(tier: CosignTierName): TierInfo {
  return TIER_INFO[tier];
}

/** @deprecated Use `getTierForCosignCount` */
export function getTierInfoFromCosigns(count: number): TierInfo {
  const d = getTierForCosignCount(count);
  return TIER_INFO[d.name];
}
