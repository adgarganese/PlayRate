/**
 * Dev-only auth diagnostics. No secrets. Used to debug TestFlight sign-in.
 * All logs are behind __DEV__.
 */

export function logAuthDiagnostics(opts: {
  hasSupabaseUrl: boolean;
  supabaseClientInit: boolean;
  hasSession: boolean;
  hasUserId: boolean;
}): void {
  if (!__DEV__) return;
  console.log('[AuthDiagnostics]', {
    EXPO_PUBLIC_SUPABASE_URL_present: opts.hasSupabaseUrl,
    supabase_client_initialized: opts.supabaseClientInit,
    session_on_start: opts.hasSession,
    user_id_present: opts.hasUserId,
  });
}

export function logCaughtError(err: unknown): void {
  if (!__DEV__) return;
  const message = err instanceof Error ? err.message : String(err);
  const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
  const stack = err instanceof Error ? err.stack : undefined;
  console.warn('[AuthDiagnostics] caught error', { message, code, stack });
}
