import '@/lib/sentry-bootstrap';
import { useEffect } from 'react';
import { View } from 'react-native';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { OfflineBanner } from '@/components/OfflineBanner';
import { AuthProvider, useAuth } from '@/contexts/auth-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { BadgeProvider } from '@/contexts/badge-context';
import { PRIMARY } from '@/constants/theme';
import {
  setPostHogClient,
  identifyUser,
  resetAnalytics,
  track,
  warnPostHogKeyMissingOnce,
  POSTHOG_API_KEY,
  POSTHOG_HOST,
} from '@/lib/analytics';
import { setSentryUser, setSentryRoute, isSentryEnabled, Sentry } from '@/lib/sentry';
import { logBootFallback } from '@/lib/boot-log';
import { mergeQueryAndHash, isAuthCallbackUrl } from '@/lib/parse-auth-url';
import {
  isInboundAppContentLink,
  resolveAppPathFromInboundLink,
} from '@/lib/deep-links';
import { supabase } from '@/lib/supabase';
import { hideSplashOnce } from '@/lib/splash-control';
import { logger } from '@/lib/logger';
import {
  registerForPushNotifications,
  subscribeForegroundPushResume,
  subscribeToPushNotificationResponses,
} from '@/lib/push-notifications';

// Catch unhandled promise rejections so they don't crash the app (e.g. Supabase .single() throw)
const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : undefined;
if (g && typeof (g as any).addEventListener === 'function') {
  (g as any).addEventListener('unhandledrejection', (event: { reason?: unknown; preventDefault?: () => void }) => {
    const err = event?.reason;
    if (err && isSentryEnabled() && Sentry?.captureException) {
      Sentry.captureException(err, { extra: { unhandledRejection: true } });
    }
    if (err) {
      logger.warn('Unhandled promise rejection', { err });
    }
    try {
      event?.preventDefault?.();
    } catch {
      /* preventDefault may throw in some environments */
    }
  });
}

// Keep native splash visible until SplashAuthGate calls hideAsync (must run at module load, before first paint).
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: 'index',
};

/** Connects the PostHog client from context to lib/analytics so track() etc. work from anywhere. */
function PostHogBridge({ children }: { children: React.ReactNode }) {
  const posthog = usePostHog();
  useEffect(() => {
    setPostHogClient(posthog ?? null);
    return () => setPostHogClient(null);
  }, [posthog]);
  return <>{children}</>;
}

/** Updates Sentry context with current route when pathname changes. */
function SentryRouteTracker() {
  const pathname = usePathname();
  useEffect(() => {
    setSentryRoute(pathname ?? '');
  }, [pathname]);
  return null;
}

/** Must exceed auth-context hydration cap (~12s) so we don't dismiss splash before auth finishes. */
const SPLASH_ABSOLUTE_MAX_MS = 16_000;

/**
 * Hide native splash only when:
 * - Fonts finished (success or failure — never block forever on font load), and
 * - Auth initial hydration finished (`loading === false`).
 * Post-splash data (badges, feeds) loads in screens / providers — not gated here.
 */
function SplashAuthGate({ fontsReady }: { fontsReady: boolean }) {
  const { loading: authLoading } = useAuth();

  useEffect(() => {
    const ready = fontsReady && !authLoading;
    if (ready) {
      hideSplashOnce();
      return;
    }

    const absoluteCap = setTimeout(() => {
      if (__DEV__) logBootFallback('splash_absolute_cap');
      hideSplashOnce();
    }, SPLASH_ABSOLUTE_MAX_MS);

    return () => clearTimeout(absoluteCap);
  }, [fontsReady, authLoading]);

  return null;
}

/** Offline banner + navigation; AuthProvider wraps this from RootLayout so session restore runs in parallel with PostHog init. */
function AppShell({ fontsReady }: { fontsReady: boolean }) {
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <View style={{ flex: 1 }}>
        <SplashAuthGate fontsReady={fontsReady} />
        <RootLayoutNavInner />
      </View>
    </View>
  );
}

function PushNotificationBootstrap() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user?.id) return;
    void registerForPushNotifications(user.id);
  }, [authLoading, user?.id]);

  useEffect(() => subscribeForegroundPushResume(user?.id, authLoading), [user?.id, authLoading]);

  useEffect(() => subscribeToPushNotificationResponses(router), [router]);

  return null;
}

function RootLayoutNavInner() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { user } = useAuth();

  // Identity: run only when user id changes to avoid flapping; identify once per user, reset on logout
  useEffect(() => {
    const userId = user?.id;
    if (userId) {
      identifyUser(userId, {
        username: user?.user_metadata?.username as string | undefined,
        name: user?.user_metadata?.name as string | undefined,
      });
    } else {
      resetAnalytics();
    }
  }, [user?.id, user?.user_metadata?.name, user?.user_metadata?.username]);

  // Sentry: set user context when auth changes (only used when DSN is set)
  useEffect(() => {
    setSentryUser(user?.id ?? null);
  }, [user?.id]);

  // Create custom navigation themes based on our color system
  const customLightTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      primary: PRIMARY,
      background: '#EEF1F5', // LightColors.bg
      card: '#FFFFFF', // LightColors.surface
      text: '#0B1020', // LightColors.text
      border: '#D8DEE9', // LightColors.border
      notification: PRIMARY,
    },
  };
  
  const customDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      primary: PRIMARY,
      background: '#070A10', // DarkColors.bg (near-black app background)
      card: '#12182A', // DarkColors.surface
      text: '#F4F7FF', // DarkColors.text
      border: '#24304A', // DarkColors.border
      notification: PRIMARY,
    },
  };

  useEffect(() => {
    // Handle deep links for password reset and playrate:// in-app routes
    const handleUrl = (url: string, options: { isInitial?: boolean } = {}) => {
      try {
        const parsed = Linking.parse(url);
        const { path, queryParams, hostname } = parsed;
        const merged = mergeQueryAndHash(url);

        const recoveryType =
          merged.type === 'recovery' || queryParams?.type === 'recovery';
        const accessToken =
          merged.access_token || (queryParams?.access_token as string | undefined);
        const refreshToken =
          merged.refresh_token || (queryParams?.refresh_token as string | undefined);
        const hasRecoveryTokens = Boolean(accessToken && refreshToken);
        const isSupabaseUrl = hostname?.includes('supabase.co');

        const isResetPassword =
          path === 'reset-password' ||
          path?.includes('reset-password') ||
          (recoveryType && hasRecoveryTokens) ||
          (isSupabaseUrl && recoveryType);

        if (isResetPassword) {
          if (recoveryType && hasRecoveryTokens && accessToken && refreshToken) {
            void supabase.auth
              .setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              })
              .then(({ error }) => {
                setTimeout(() => {
                  router.replace(error ? '/sign-in' : '/reset-password');
                }, 100);
              });
            return;
          }
          setTimeout(() => {
            router.replace('/reset-password');
          }, 100);
          return;
        }

        // Supabase OAuth / magic link / email confirmation → /auth/callback (handles tokens in query or #fragment)
        if (isAuthCallbackUrl(url)) {
          setTimeout(() => {
            router.replace('/auth/callback' as any);
          }, 100);
          return;
        }

        // In-app navigation: custom scheme + allowed HTTPS hosts (see lib/deep-links.ts, docs/deep-links.md)
        if (url && isInboundAppContentLink(url)) {
          const target = path ?? url;
          track('notification_opened', {
            notification_type: 'deep_link',
            deep_link_target: target,
          });
          const route = resolveAppPathFromInboundLink(url) ?? '/(tabs)';
          const isInitial = options.isInitial === true;
          setTimeout(() => {
            if (isInitial) {
              router.replace(route as any);
            } else {
              router.push(route as any);
            }
          }, 100);
        }
      } catch (error) {
        if (__DEV__) console.warn('[root:deepLink]', error);
      }
    };

    // Listen for deep links when app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url, { isInitial: false });
    });

    // Check for initial URL when app opens from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url, { isInitial: true });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
      {isSentryEnabled() && <SentryRouteTracker />}
      <PushNotificationBootstrap />
      <BadgeProvider userId={user?.id ?? null}>
      <Stack
        screenOptions={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="sign-in"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="sign-up"
          options={{ headerShown: false, presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="forgot-password"
          options={{ title: 'Forgot Password', presentation: 'modal', animation: 'slide_from_bottom' }}
        />
        <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="auth/callback" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="my-sports" options={{ title: 'My Sports', headerShown: false }} />
        <Stack.Screen name="self-ratings" options={{ title: 'Self Ratings', headerShown: false }} />
        <Stack.Screen name="profiles" options={{ title: 'Athletes' }} />
        <Stack.Screen name="athletes" options={{ headerShown: false }} />
        <Stack.Screen name="inbox" options={{ title: 'Inbox', headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="runs" options={{ title: 'Run Recap', headerShown: false }} />
        {__DEV__ && <Stack.Screen name="test-connection" options={{ title: 'Connection Test' }} />}
        <Stack.Screen
          name="modal"
          options={{ presentation: 'modal', title: 'Modal', animation: 'slide_from_bottom' }}
        />
      </Stack>
      </BadgeProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

function RootLayout() {
  // Custom fonts (parallel with AuthProvider effects — see tree below)
  const [fontsLoaded, fontError] = useFonts({
    'BarlowCondensed-ExtraBoldItalic': require('@/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
    'BarlowCondensed-Bold': require('@/assets/fonts/BarlowCondensed-Bold.ttf'),
    'Rajdhani-Medium': require('@/assets/fonts/Rajdhani-Medium.ttf'),
    'Rajdhani-Regular': require('@/assets/fonts/Rajdhani-Regular.ttf'),
  });
  const fontsReady = fontsLoaded || fontError != null;
  if (fontError) {
    logger.warn('Custom fonts failed to load; using system fonts', {
      err: fontError,
      message: fontError.message,
    });
  }

  if (!POSTHOG_API_KEY) {
    warnPostHogKeyMissingOnce();
  }

  const shell = <AppShell fontsReady={fontsReady} />;

  return (
    <ErrorBoundary fallbackMessage="Something went wrong. Try again or restart the app.">
      <ThemeProvider>
        <SafeAreaProvider>
          <AuthProvider>
            {POSTHOG_API_KEY ? (
              <PostHogProvider apiKey={POSTHOG_API_KEY} options={{ host: POSTHOG_HOST }}>
                <PostHogBridge>{shell}</PostHogBridge>
              </PostHogProvider>
            ) : (
              shell
            )}
          </AuthProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default isSentryEnabled() ? Sentry.wrap(RootLayout) : RootLayout;
