/**
 * DEV-only logging. In production/beta builds these no-op so logs do not run.
 */
export function devWarn(scope: string, ...args: unknown[]): void {
  if (__DEV__) console.warn(`[${scope}]`, ...args);
}

export function devError(scope: string, ...args: unknown[]): void {
  if (__DEV__) console.error(`[${scope}]`, ...args);
}
