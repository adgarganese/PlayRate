import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resetAnalytics } from '../lib/analytics';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | { message: string } | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyPhoneOtp: (phone: string, token: string, username?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        ensureProfileExists(session.user.id).catch((e) => {
          if (__DEV__) console.warn('[Auth] ensureProfileExists (initial)', e);
        });
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      if (session?.user) {
        try {
          await ensureProfileExists(session.user.id);
        } catch (e) {
          if (__DEV__) console.warn('[Auth] ensureProfileExists', e);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Helper function to ensure profile exists (use maybeSingle to avoid throw when no row - .single() crashes on TestFlight)
  const ensureProfileExists = async (userId: string) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    // If no profile exists, try to create one
    if (!existingProfile) {
      // Get user metadata for username
      const { data: { user } } = await supabase.auth.getUser();
      
      // Generate username: prefer metadata, then email prefix, then phone number, then fallback
      let username = user?.user_metadata?.username;
      if (!username) {
        if (user?.email) {
          username = user.email.split('@')[0];
        } else if (user?.phone) {
          // Use last 4 digits of phone as username base
          const phoneDigits = user.phone.replace(/\D/g, '');
          username = `user_${phoneDigits.slice(-4)}`;
        } else {
          username = `user_${userId.slice(0, 8)}`;
        }
      }
      
      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username: username,
          name: null,
          bio: null,
        });

      if (error && __DEV__) {
        console.error('Failed to create profile:', error);
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, username: string) => {
    // Sign up the user with username in metadata
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username,
        },
      },
    });

    if (error) {
      return { error };
    }

    // Try to create profile immediately if we have a session
    if (data.user) {
      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // We have a session, try to create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: username,
            name: null,
            bio: null,
          });

        if (profileError) {
          // If it fails, it might be because:
          // 1. Trigger already created it (duplicate key - that's OK)
          // 2. RLS blocking it (will be created by trigger or on email confirmation)
          // 3. Some other error
          if (!profileError.message.includes('duplicate key') &&
              !profileError.message.includes('violates row-level security')) {
            if (__DEV__) console.error('Profile creation error:', profileError);
            // Return error so user knows
            return { 
              error: {
                message: `Account created, but profile creation failed: ${profileError.message}. Please try signing in after email verification.`
              }
            };
          }
        }
      } else {
        // No session yet (email confirmation required)
        // Profile will be created by trigger or when they sign in after email confirmation
        if (__DEV__) console.log('No session yet - profile will be created after email confirmation');
      }
    }

    return { error: null };
  };

  const signInWithPhone = async (phone: string) => {
    // Send OTP to phone number
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    return { error };
  };

  const verifyPhoneOtp = async (phone: string, token: string, username?: string) => {
    // Verify OTP and sign in/up
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms',
    });

    if (error) {
      return { error };
    }

    // If this is a new user and username is provided, store it in metadata
    if (data.user && username) {
      await supabase.auth.updateUser({
        data: {
          username: username,
        },
      });
    }

    // Ensure profile exists after successful verification
    if (data.user) {
      // Wait a moment for auth to settle
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Try to create profile with username if provided
        const profileUsername = username || 
          data.user.user_metadata?.username || 
          (data.user.phone ? `user_${data.user.phone.replace(/\D/g, '').slice(-4)}` : `user_${data.user.id.slice(0, 8)}`);
        
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: profileUsername,
            name: null,
            bio: null,
          });

        if (profileError) {
          // If it fails, it might be because trigger already created it (that's OK)
          if (!profileError.message.includes('duplicate key') &&
              !profileError.message.includes('violates row-level security') && __DEV__) {
            console.error('Profile creation error:', profileError);
          }
        }
      }
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      resetAnalytics();
      const { error } = await supabase.auth.signOut();
      if (error) {
        if (__DEV__) console.error('Sign out error:', error);
        throw error;
      }
      // Explicitly clear the session state
      setSession(null);
      setUser(null);
      
      // On web, ensure localStorage is cleared (Supabase should do this, but double-check)
      if (typeof window !== 'undefined') {
        // Wait a moment for Supabase to clear storage
        await new Promise(resolve => setTimeout(resolve, 50));
        // Verify session is cleared
        const { data: { session } } = await supabase.auth.getSession();
        if (session && __DEV__) {
          console.warn('Session still exists after sign out, forcing clear');
          setSession(null);
          setUser(null);
        }
      }
    } catch (error) {
      if (__DEV__) console.error('Error signing out:', error);
      // Even if there's an error, clear local state
      setSession(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      loading, 
      signIn, 
      signUp, 
      signInWithPhone, 
      verifyPhoneOtp, 
      signOut 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

