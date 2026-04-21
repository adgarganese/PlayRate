/**
 * PostgREST / Postgres errors from check_rate_limit() include the substring
 * "Rate limit exceeded". Map those to a single user-facing line for alerts.
 */
export const RPC_RATE_LIMIT_USER_MESSAGE =
  "You're doing that too fast. Please wait a moment.";

export function isRpcRateLimitError(err: unknown): boolean {
  const m = extractErrorMessage(err);
  return m.includes('Rate limit exceeded');
}

function extractErrorMessage(err: unknown): string {
  if (err == null) return '';
  if (typeof err === 'string') return err;
  if (typeof err === 'object' && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === 'string') return m;
  }
  return '';
}
