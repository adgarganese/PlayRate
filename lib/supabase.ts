import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/config';
import { createGracefulFetch } from '@/lib/graceful-fetch';
import { supabaseAuthStorage } from '@/lib/supabase-auth-storage';

const url = String(supabaseUrl ?? '').trim();
const anonKey = String(supabaseAnonKey ?? '').trim();

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase configuration. Make sure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your .env.local or EAS secrets.'
  );
}

/**
 * Supabase client with persisted auth session.
 * Native: Keychain / EncryptedSharedPreferences via expo-secure-store when possible (see supabase-auth-storage).
 * Web: AsyncStorage-backed adapter (same module uses AsyncStorage on web).
 */
export const supabase = createClient(url, anonKey, {
  global: {
    fetch: createGracefulFetch(),
  },
  auth: {
    storage: supabaseAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
});