/**
 * Dev-only error logging. No-op in production.
 */
export function logDevError(scope: string, error: unknown): void {
  if (__DEV__) {
    console.warn(`[${scope}]`, error);
  }
}
