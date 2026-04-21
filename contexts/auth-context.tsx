import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resetAnalytics, track } from '../lib/analytics';
import { isSupabaseConfigured, supabaseUrl } from '../lib/config';
import { logAuthDiagnostics, logCaughtError } from '../lib/auth-diagnostics';
import {
  logBootAuthEvent,
  logBootFirstRouteDecision,
  logBootProfileEnd,
  logBootProfileStart,
  logBootSessionEnd,
  logBootSessionStart,
} from '../lib/boot-log';
import { logger } from '../lib/logger';
import { sanitizeUsername } from '../lib/sanitize';
import { unregisterPushToken } from '../lib/push-notifications';

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

async function emitProfileCreatedAnalytics(userId: string): Promise<void> {
  try {
    const { count } = await supabase
      .from('profile_sports')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
    const { data: p } = await supabase.from('profiles').select('avatar_url').eq('user_id', userId).maybeSingle();
    track('profile_created', {
      has_avatar: !!(p?.avatar_url && String(p.avatar_url).trim()),
      sports_count: count ?? 0,
    });
  } catch {
    track('profile_created', { has_avatar: false, sports_count: 0 });
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);

  const ensureProfileExists = useCallback(async (userId: string) => {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!existingProfile) {
      const { data: { user } } = await supabase.auth.getUser();

      let username = user?.user_metadata?.username;
      if (!username) {
        if (user?.email) {
          username = sanitizeUsername(user.email.split('@')[0] || '');
        } else if (user?.phone) {
          const phoneDigits = user.phone.replace(/\D/g, '');
          username = `user_${phoneDigits.slice(-4)}`;
        } else {
          username = `user_${userId.slice(0, 8)}`;
        }
      } else {
        username = sanitizeUsername(username);
      }
      if (username.length < 3) {
        username = `user_${userId.slice(0, 8)}`;
      }

      const { error } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          username,
          name: null,
          bio: null,
          onboarding_completed: false,
        });

      if (error) {
        logger.error('Failed to create profile (ensureProfileExists)', {
          err: error,
          userId,
        });
      } else {
        void emitProfileCreatedAnalytics(userId);
      }
    }
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, username: string) => {
    const normalizedUsername = sanitizeUsername(username);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: normalizedUsername,
        },
        ...(Platform.OS !== 'web'
          ? { emailRedirectTo: 'playrate://auth/callback' }
          : {}),
      },
    });

    if (error) {
      return { error };
    }

    if (data.user) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: normalizedUsername,
            name: null,
            bio: null,
            onboarding_completed: false,
          });

        if (profileError) {
          if (!profileError.message.includes('duplicate key') &&
              !profileError.message.includes('violates row-level security')) {
            logger.error('Profile insert failed after email sign-up', {
              code: profileError.code,
              message: profileError.message,
            });
            return {
              error: {
                message:
                  'Account was created but your profile could not be set up. After you verify your email, try signing in — your profile may complete automatically.',
              },
            };
          }
        } else {
          void emitProfileCreatedAnalytics(data.user.id);
        }
      } else {
        if (__DEV__) {
          logger.info('Auth: no session on sign-up yet; profile after email confirmation');
        }
      }
    }

    return { error: null };
  }, []);

  const signInWithPhone = useCallback(async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone: phone,
    });
    return { error };
  }, []);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string, username?: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: phone,
      token: token,
      type: 'sms',
    });

    if (error) {
      return { error };
    }

    if (data.user && username) {
      await supabase.auth.updateUser({
        data: {
          username: sanitizeUsername(username),
        },
      });
    }

    if (data.user) {
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const rawProfileUsername = username ||
          data.user.user_metadata?.username ||
          (data.user.phone ? `user_${data.user.phone.replace(/\D/g, '').slice(-4)}` : `user_${data.user.id.slice(0, 8)}`);
        let profileUsername = sanitizeUsername(String(rawProfileUsername));
        if (profileUsername.length < 3) {
          profileUsername = `user_${data.user.id.slice(0, 8)}`;
        }

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            user_id: data.user.id,
            username: profileUsername,
            name: null,
            bio: null,
            onboarding_completed: false,
          });

        if (profileError) {
          if (!profileError.message.includes('duplicate key') &&
              !profileError.message.includes('violates row-level security')) {
            logger.error('Profile insert failed after phone OTP', {
              err: profileError,
              userId: data.user.id,
            });
          }
        } else {
          void emitProfileCreatedAnalytics(data.user.id);
        }
      }
    }

    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    try {
      track('sign_out', {});
      await unregisterPushToken();
      resetAnalytics();
      const { error } = await supabase.auth.signOut();
      if (error) {
        logger.error('Sign out failed', { err: error });
        throw error;
      }
      setSession(null);
      setUser(null);

      if (typeof window !== 'undefined') {
        await new Promise(resolve => setTimeout(resolve, 50));
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          logger.warn('Session still present after signOut (web); clearing local state', {
            scope: 'auth',
          });
          setSession(null);
          setUser(null);
        }
      }
    } catch (error) {
      logger.error('Sign out threw', { err: error });
      setSession(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setConfigError(
        'EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY is missing. Set them in EAS environment variables (Expo dashboard or eas env:create).'
      );
      setLoading(false);
      if (__DEV__) logBootSessionEnd('skipped', 'supabase_not_configured');
      return;
    }

    let cancelled = false;
    const HYDRATION_TIMEOUT_MS = 12000;
    const hydrationDoneRef = { current: false };
    const profileBootstrappedForUserId = { current: null as string | null };

    const finishInitialHydration = (signedIn: boolean) => {
      if (cancelled || hydrationDoneRef.current) return;
      hydrationDoneRef.current = true;
      setLoading(false);
      if (__DEV__) {
        logBootSessionEnd('ready');
        logBootFirstRouteDecision(signedIn);
      }
    };

    const scheduleProfileBootstrap = (userId: string, event: string) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_OUT') return;
      if (profileBootstrappedForUserId.current === userId) return;
      profileBootstrappedForUserId.current = userId;
      if (__DEV__) logBootProfileStart(userId);
      void ensureProfileExists(userId)
        .then(() => {
          if (__DEV__) logBootProfileEnd('ok');
        })
        .catch((e) => {
          if (__DEV__) {
            logBootProfileEnd('error');
            logCaughtError(e);
          }
        });
    };

    if (__DEV__) logBootSessionStart();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (cancelled) return;
      if (__DEV__ && event !== 'TOKEN_REFRESHED') logBootAuthEvent(event);
      setSession(session);
      setUser(session?.user ?? null);
      if (!session?.user) {
        profileBootstrappedForUserId.current = null;
      }
      finishInitialHydration(!!session?.user);
      if (session?.user) {
        scheduleProfileBootstrap(session.user.id, event);
      }
    });

    supabase.auth
      .getSession()
      .then(({ data: { session: s }, error }) => {
        if (cancelled) return;
        if (__DEV__) {
          if (error) logCaughtError(error);
          logAuthDiagnostics({
            hasSupabaseUrl: !!supabaseUrl,
            supabaseClientInit: !!supabase?.auth,
            hasSession: !!s,
            hasUserId: !!s?.user?.id,
          });
        }
        setSession(s);
        setUser(s?.user ?? null);
        if (!hydrationDoneRef.current) {
          finishInitialHydration(!!s?.user);
        }
        if (s?.user) {
          scheduleProfileBootstrap(s.user.id, 'GET_SESSION');
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (__DEV__) logCaughtError(e);
        if (!hydrationDoneRef.current) finishInitialHydration(false);
      });

    const timeoutId = setTimeout(() => {
      if (cancelled) return;
      if (!hydrationDoneRef.current) {
        if (__DEV__) logBootSessionEnd('ready', 'timeout_unblock');
        hydrationDoneRef.current = true;
        setLoading(false);
      }
    }, HYDRATION_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [ensureProfileExists]);

  const authValue = useMemo(
    () => ({
      session,
      user,
      loading,
      signIn,
      signUp,
      signInWithPhone,
      verifyPhoneOtp,
      signOut,
    }),
    [session, user, loading, signIn, signUp, signInWithPhone, verifyPhoneOtp, signOut]
  );

  if (configError) throw new Error(configError);

  return (
    <AuthContext.Provider value={authValue}>
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

