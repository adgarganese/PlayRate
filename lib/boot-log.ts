/**
 * Dev-only startup tracing. No secrets; keep messages short.
 */

import { logger } from '@/lib/logger';

export function logBootSessionStart(): void {
  if (!__DEV__) return;
  logger.info('[boot] session_hydration start');
}

export function logBootSessionEnd(reason: 'ready' | 'skipped', detail?: string): void {
  if (!__DEV__) return;
  logger.info('[boot] session_hydration end', { reason, detail: detail ?? '' });
}

export function logBootAuthEvent(event: string): void {
  if (!__DEV__) return;
  logger.info('[boot] auth_event', { event });
}

export function logBootProfileStart(userIdPrefix: string): void {
  if (!__DEV__) return;
  logger.info('[boot] profile_bootstrap start', { userIdPrefix: userIdPrefix.slice(0, 8) });
}

export function logBootProfileEnd(outcome: 'ok' | 'error'): void {
  if (!__DEV__) return;
  logger.info('[boot] profile_bootstrap end', { outcome });
}

export function logBootFirstRouteDecision(signedIn: boolean): void {
  if (!__DEV__) return;
  logger.info('[boot] first_route', { target: signedIn ? 'tabs_or_signed_in' : 'sign_in' });
}

export function logBootFallback(reason: string): void {
  if (!__DEV__) return;
  logger.info('[boot] fallback', { reason });
}

/** Root index redirect (tabs vs sign-in); once per mount in dev. */
export function logBootIndexRoute(target: '(tabs)' | 'sign-in'): void {
  if (!__DEV__) return;
  logger.info('[boot] index_route', { target });
}
