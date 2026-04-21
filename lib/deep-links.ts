import { universalLinkHost } from '@/lib/config';

/**
 * Canonical share / DM link targets (custom scheme). Keep in sync with `resolveAppPathFromInboundLink`.
 */
export function playrateHighlightUrl(highlightId: string): string {
  return `playrate://highlights/${highlightId}`;
}

export function playrateCourtUrl(courtId: string): string {
  return `playrate://courts/${courtId}`;
}

function normalizeConfiguredUniversalHost(): string | undefined {
  const raw = universalLinkHost?.trim();
  if (!raw) return undefined;
  return raw.replace(/^https?:\/\//, '').split('/')[0]?.toLowerCase().trim() || undefined;
}

/** Hostnames that may serve HTTPS app paths (universal links / App Links). */
export function isAllowedUniversalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const configured = normalizeConfiguredUniversalHost();
  if (configured && host === configured) return true;
  return host === 'playrate.app' || host === 'www.playrate.app';
}

export function isTrustedHttpsAppLink(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return u.protocol === 'https:' && isAllowedUniversalHostname(u.hostname);
  } catch {
    return false;
  }
}

/**
 * True when this URL should be handled as an in-app navigation target (after auth / password flows).
 */
export function isInboundAppContentLink(url: string): boolean {
  const u = url.trim();
  return /^playrate:\/\//i.test(u) || isTrustedHttpsAppLink(u);
}

function splitPathSegmentsFromPlayrateUrl(url: string): string[] | null {
  const trimmed = url.trim();
  if (!/^playrate:\/\//i.test(trimmed)) return null;
  const pathPart = trimmed.replace(/^playrate:\/\//i, '');
  const noQuery = pathPart.split(/[?#]/)[0] ?? '';
  return noQuery.replace(/^\/+/, '').split('/').filter(Boolean);
}

function splitPathSegmentsFromHttpsUrl(url: string): string[] | null {
  try {
    const u = new URL(url.trim());
    if (u.protocol !== 'https:') return null;
    if (!isAllowedUniversalHostname(u.hostname)) return null;
    const p = u.pathname.replace(/^\/+|\/+$/g, '');
    return p.split('/').filter(Boolean);
  } catch {
    return null;
  }
}

/**
 * Maps path segments (from playrate://… or allowed https://…) to an Expo Router path.
 * Returns null when the URL is not a recognized content route (caller typically sends user Home).
 */
export function resolveAppPathFromInboundLink(url: string): string | null {
  const segments =
    splitPathSegmentsFromPlayrateUrl(url) ?? splitPathSegmentsFromHttpsUrl(url);
  if (!segments || segments.length === 0) return null;

  const [first, second, third] = segments;

  if (first === 'highlights' && second) {
    return `/highlights/${second}`;
  }
  if (first === 'profile' && second === 'highlights' && third) {
    return `/highlights/${third}`;
  }
  if (first === 'courts' && second === 'run' && third) {
    return `/courts/run/${third}`;
  }
  if (first === 'courts' && second) {
    return `/courts/${second}`;
  }
  if (first === 'runs' && second) {
    return `/courts/run/${second}`;
  }
  if (first === 'athletes' && second) {
    if (third === 'profile') {
      return `/athletes/${second}/profile`;
    }
    return `/athletes/${second}`;
  }
  if (first === 'chat' && second) {
    return `/chat/${second}`;
  }

  return null;
}
