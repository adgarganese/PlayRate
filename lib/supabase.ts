import { createClient } from '@supabase/supabase-js';
import { supabaseUrl, supabaseAnonKey } from '@/lib/config';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true, // Automatically detect tokens in URL (works on web)
    flowType: 'pkce',
  },
});