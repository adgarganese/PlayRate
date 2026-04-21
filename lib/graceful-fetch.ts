import { logger } from '@/lib/logger';

/**
 * Wraps fetch so offline / DNS / TLS handshake failures return a JSON 503 Response
 * instead of throwing. Lets clients like Supabase surface { error } instead of unhandled rejections.
 */
export function createGracefulFetch(
  baseFetch: typeof fetch = globalThis.fetch.bind(globalThis)
): typeof fetch {
  return async (input, init) => {
    try {
      return await baseFetch(input as RequestInfo | URL, init);
    } catch (cause) {
      logger.warn('Network fetch failed (graceful 503)', { err: cause });
      return new Response(
        JSON.stringify({
          message: 'Network request failed',
          code: 'network_unreachable',
        }),
        {
          status: 503,
          statusText: 'Network Unavailable',
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  };
}
