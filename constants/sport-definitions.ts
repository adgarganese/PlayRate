/**
 * Sport Definitions
 * Single source of truth for sport-specific data (attribute lists in display order, play style options).
 * Attributes must be in the exact order specified for consistent UI rendering.
 */

import { SOCCER_ENABLED } from './features';

export type SportKey = 'basketball' | 'soccer';

export type PlayStyleOption = string;

export interface SportDefinition {
  key: SportKey;
  name: string;
  attributes: {
    slug: string;
    label: string;
  }[];
  playStyles: PlayStyleOption[];
  customPlayStyleLabel?: string; // For "Custom" option if supported
}

export const SPORT_DEFINITIONS: Record<SportKey, SportDefinition> = {
  basketball: {
    key: 'basketball',
    name: 'Basketball',
    attributes: [
      { slug: 'shooting', label: 'Shooting' },
      { slug: 'playmaking', label: 'Playmaking' },
      { slug: 'rebounding', label: 'Rebounding' },
      { slug: 'finishing', label: 'Finishing' },
      { slug: 'dribbling', label: 'Dribbling' },
      { slug: 'perimeter-defense', label: 'Perimeter Defense' },
      { slug: 'post-defense', label: 'Post Defense' },
      { slug: 'athleticism', label: 'Athleticism' },
    ],
    playStyles: [
      'Shot Creator',
      '3&D',
      'Playmaker',
      'Lockdown Defender',
      'Rim Runner',
      'Post / Inside',
      'All-Around',
      'Energy / Hustle',
    ],
    customPlayStyleLabel: 'Custom',
  },
  soccer: {
    key: 'soccer',
    name: 'Soccer',
    attributes: [
      { slug: 'athleticism', label: 'Athleticism' },
      { slug: 'speed-acceleration', label: 'Speed / Acceleration' },
      { slug: 'stamina-work-rate', label: 'Stamina / Work Rate' },
      { slug: 'ball-control', label: 'Ball Control' },
      { slug: 'first-touch', label: 'First Touch' },
      { slug: 'dribbling', label: 'Dribbling' },
      { slug: 'passing', label: 'Passing' },
      { slug: 'vision', label: 'Vision' },
      { slug: 'shooting-finishing', label: 'Shooting / Finishing' },
      { slug: 'defending', label: 'Defending' },
    ],
    playStyles: [
      'Striker / Finisher',
      'Playmaker',
      'Winger',
      'Box-to-Box',
      'Defensive Mid',
      'Center Back',
      'Fullback',
      'Goalkeeper',
    ],
    customPlayStyleLabel: 'Custom',
  },
};

/**
 * Whether a sport (by key or display name) is enabled in the app (gated by SOCCER_ENABLED).
 */
export function isSportEnabled(sportNameOrKey: string): boolean {
  const key = sportNameOrKey.toLowerCase().trim();
  if (key === 'basketball') return true;
  if (key === 'soccer') return SOCCER_ENABLED;
  return true; // unknown sport: allow (e.g. future sports)
}

/**
 * Get list of enabled sport keys (for filtering UI).
 */
export function getEnabledSportKeys(): SportKey[] {
  return SOCCER_ENABLED ? ['basketball', 'soccer'] : ['basketball'];
}

/**
 * Get sport definition by name (case-insensitive)
 */
export function getSportDefinition(sportName: string): SportDefinition | null {
  const normalized = sportName.toLowerCase().trim();
  
  for (const [key, definition] of Object.entries(SPORT_DEFINITIONS)) {
    if (definition.name.toLowerCase() === normalized || key === normalized) {
      return definition;
    }
  }
  
  return null;
}

/**
 * Get sport definition by key
 */
export function getSportDefinitionByKey(sportKey: SportKey): SportDefinition {
  return SPORT_DEFINITIONS[sportKey];
}

/**
 * Get attribute slug from label (for matching database attributes to definitions)
 */
export function getAttributeSlugFromLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/[\/\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Get ordered attributes for a sport based on database results
 * This ensures attributes are displayed in the correct order even if
 * the database returns them in a different order.
 */
export function getOrderedAttributes(
  sportName: string,
  dbAttributes: { id: string; name: string; sport_id: string }[]
): { id: string; name: string; sport_id: string; order: number }[] {
  const definition = getSportDefinition(sportName);
  
  if (!definition) {
    // If no definition found, return as-is (fallback)
    return dbAttributes.map((attr, index) => ({
      ...attr,
      order: index,
    }));
  }
  
  // Create a map of label -> attribute
  const attrMap = new Map(
    dbAttributes.map(attr => [attr.name, attr])
  );
  
  // Build ordered array based on definition
  const ordered: { id: string; name: string; sport_id: string; order: number }[] = [];
  
  definition.attributes.forEach((defAttr, index) => {
    // Try exact match first
    let dbAttr = attrMap.get(defAttr.label);
    
    // If no exact match, try case-insensitive
    if (!dbAttr) {
      for (const [label, attr] of attrMap.entries()) {
        if (label.toLowerCase() === defAttr.label.toLowerCase()) {
          dbAttr = attr;
          break;
        }
      }
    }
    
    if (dbAttr) {
      ordered.push({
        ...dbAttr,
        order: index,
      });
      attrMap.delete(dbAttr.name); // Remove to avoid duplicates
    }
  });
  
  // Add any remaining attributes that weren't in the definition (shouldn't happen, but safe fallback)
  let remainingIndex = ordered.length;
  attrMap.forEach((attr) => {
    ordered.push({
      ...attr,
      order: remainingIndex++,
    });
  });

  return ordered;
}

/**
 * Get play styles for a sport
 */
export function getPlayStylesForSport(sportName: string): PlayStyleOption[] {
  const definition = getSportDefinition(sportName);
  return definition?.playStyles || [];
}
