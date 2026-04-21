// TODO: [CLEANUP] Migrate remaining console.log/warn/error calls across the app to use this logger.
// Files with known console usage: lib/config.ts, lib/analytics.ts, lib/auth-diagnostics.ts,
// lib/geocoding.ts, lib/dev-log.ts, lib/logging.ts, and scattered across app/ and hooks/.
// Decision needed: which files intentionally keep console (dev-only, config bootstrapping)
// vs which should switch to logger.

/**
 * Unified logging: dev → console; production → Sentry (when DSN is set via lib/sentry.ts).
 * Root layout is wrapped with Sentry.wrap when enabled; use logger for explicit reporting.
 */

import { isSentryEnabled, Sentry } from '@/lib/sentry';

export type LogMetadata = Record<string, unknown>;

function stripErr(meta?: LogMetadata & { err?: unknown }): LogMetadata {
  if (!meta) return {};
  const { err: _e, ...rest } = meta;
  return rest;
}

function toBreadcrumbData(
  meta?: LogMetadata
): Record<string, string | number | boolean | null | undefined> | undefined {
  if (!meta || Object.keys(meta).length === 0) return undefined;
  const out: Record<string, string | number | boolean | null | undefined> = {};
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined) continue;
    if (v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      out[k] = v;
    } else {
      try {
        out[k] = JSON.stringify(v);
      } catch {
        out[k] = String(v);
      }
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeError(err: unknown): Error | null {
  if (err instanceof Error) return err;
  if (typeof err === 'string') return new Error(err);
  return null;
}

export const logger = {
  /** Dev-only verbose diagnostics (e.g. non-fatal probe failures). Production: no-op. */
  debug(message: string, err?: unknown): void {
    if (!__DEV__) return;
    if (err !== undefined) {
      console.debug(`[PlayRate] ${message}`, err);
    } else {
      console.debug(`[PlayRate] ${message}`);
    }
  },

  /** Dev: console.log. Prod: Sentry breadcrumb only (no issue). */
  info(message: string, meta?: LogMetadata): void {
    if (__DEV__) {
      if (meta && Object.keys(meta).length > 0) {
        console.log(`[PlayRate] ${message}`, meta);
      } else {
        console.log(`[PlayRate] ${message}`);
      }
    } else if (isSentryEnabled()) {
      Sentry.addBreadcrumb({
        category: 'app',
        message,
        level: 'info',
        data: toBreadcrumbData(meta),
      });
    }
  },

  /** Dev: console.warn. Prod: Sentry message (warning level). `err` in meta is serialized, not double-attached. */
  warn(message: string, meta?: LogMetadata & { err?: unknown }): void {
    const { err, ...rest } = meta ?? {};
    const merged: LogMetadata = { ...rest };
    if (err !== undefined) {
      merged.detail =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null
            ? JSON.stringify(err)
            : String(err);
    }

    if (__DEV__) {
      if (meta && Object.keys(meta).length > 0) {
        console.warn(`[PlayRate] ${message}`, meta);
      } else {
        console.warn(`[PlayRate] ${message}`);
      }
    } else if (isSentryEnabled()) {
      Sentry.captureMessage(message, {
        level: 'warning',
        extra: merged,
      });
    }
  },

  /**
   * Dev: console.error. Prod: Sentry captureException if `err` is an Error, else captureMessage (error).
   * Pass `err` inside meta for stack traces: logger.error('Load failed', { err, userId, screen }).
   */
  error(message: string, meta?: LogMetadata & { err?: unknown }): void {
    const { err, ...rest } = (meta ?? {}) as LogMetadata & { err?: unknown };
    const asError = normalizeError(err);

    if (__DEV__) {
      if (asError) {
        console.error(`[PlayRate] ${message}`, asError, rest);
      } else if (Object.keys(rest).length > 0) {
        console.error(`[PlayRate] ${message}`, rest);
      } else {
        console.error(`[PlayRate] ${message}`);
      }
    } else if (isSentryEnabled()) {
      const extra = {
        logMessage: message,
        ...stripErr(rest as LogMetadata & { err?: unknown }),
      };
      if (asError) {
        Sentry.captureException(asError, { extra });
      } else if (err !== undefined) {
        Sentry.captureMessage(message, {
          level: 'error',
          extra: {
            ...extra,
            detail: typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err),
          },
        });
      } else {
        Sentry.captureMessage(message, { level: 'error', extra });
      }
    }
  },

  /** Dev: console.log. Prod: Sentry breadcrumb (when DSN set). */
  breadcrumb(message: string, meta?: LogMetadata): void {
    if (__DEV__) {
      if (meta && Object.keys(meta).length > 0) {
        console.log(`[PlayRate:breadcrumb] ${message}`, meta);
      } else {
        console.log(`[PlayRate:breadcrumb] ${message}`);
      }
    }
    if (isSentryEnabled()) {
      Sentry.addBreadcrumb({
        category: 'app',
        message,
        level: 'info',
        data: toBreadcrumbData(meta),
      });
    }
  },
};
