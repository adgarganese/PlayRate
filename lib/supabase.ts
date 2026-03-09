import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/config';

/**
 * Supabase client with persisted auth session.
 * In React Native/Expo there is no localStorage; we pass AsyncStorage so the
 * session is saved across app restarts. Without this, users would be signed out on every return.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // web: detect tokens in URL
    flowType: 'pkce',
  },
});