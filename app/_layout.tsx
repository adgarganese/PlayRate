import { useEffect } from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';

import { PostHogProvider, usePostHog } from 'posthog-react-native';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
import { initSentry, setSentryUser, setSentryRoute, isSentryEnabled, Sentry } from '@/lib/sentry';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: 'https://6e36fe1cd6a87d637f6080a0e87eecc4@o4510972662841344.ingest.us.sentry.io/4510972753149952',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs
  enableLogs: false,

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Enable Sentry only when EXPO_PUBLIC_SENTRY_DSN is set (e.g. EAS production/preview builds)
initSentry();

// Catch unhandled promise rejections so they don't crash the app (e.g. Supabase .single() throw)
const g = typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : undefined;
if (g && typeof (g as any).addEventListener === 'function') {
  (g as any).addEventListener('unhandledrejection', (event: { reason?: unknown; preventDefault?: () => void }) => {
    const err = event?.reason;
    if (err && isSentryEnabled() && Sentry?.captureException) {
      Sentry.captureException(err, { extra: { unhandledRejection: true } });
    }
    if (__DEV__ && err) console.warn('[unhandledRejection]', err);
    try {
      event?.preventDefault?.();
    } catch (_) {}
  });
}

// Keep splash screen visible while loading fonts
SplashScreen.preventAutoHideAsync();

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
  }, [user?.id]);

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
    // Handle deep links for password reset
    const handleUrl = (url: string) => {
      try {
        const parsed = Linking.parse(url);
        const { path, queryParams, hostname } = parsed;
        
        // Check if this is a password reset link
        const hasRecoveryType = queryParams?.type === 'recovery';
        const hasRecoveryTokens = !!(queryParams?.access_token || queryParams?.refresh_token);
        const isSupabaseUrl = hostname?.includes('supabase.co');
        
        const isResetPassword = 
          path === 'reset-password' || 
          path?.includes('reset-password') ||
          (hasRecoveryType && hasRecoveryTokens) ||
          (isSupabaseUrl && hasRecoveryType);

        if (isResetPassword) {
          const params: Record<string, string> = {};
          if (queryParams?.access_token) params.access_token = queryParams.access_token as string;
          if (queryParams?.refresh_token) params.refresh_token = queryParams.refresh_token as string;
          if (queryParams?.type) params.type = queryParams.type as string;
          
          // Small delay to ensure router is ready
          setTimeout(() => {
            router.replace({
              pathname: '/reset-password',
              params,
            });
          }, 100);
        } else if (url && (url.includes('playrate://') || hostname?.includes('playrate'))) {
          track('notification_opened', {
            notification_type: 'deep_link',
            deep_link_target: path ?? url,
          });
        }
      } catch (error) {
        if (__DEV__) console.warn('[root:deepLink]', error);
      }
    };

    // Listen for deep links when app is running
    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    // Check for initial URL when app opens from deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? customDarkTheme : customLightTheme}>
      {isSentryEnabled() && <SentryRouteTracker />}
      <BadgeProvider userId={user?.id ?? null}>
      <Stack
        screenOptions={{
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          animation: 'default',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="sign-up" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="forgot-password" options={{ title: 'Forgot Password', presentation: 'modal' }} />
        <Stack.Screen name="reset-password" options={{ title: 'Reset Password' }} />
        <Stack.Screen name="my-sports" options={{ title: 'My Sports', headerShown: false }} />
        <Stack.Screen name="self-ratings" options={{ title: 'Self Ratings', headerShown: false }} />
        <Stack.Screen name="profiles" options={{ title: 'Athletes' }} />
        <Stack.Screen name="athletes" options={{ headerShown: false }} />
        <Stack.Screen name="inbox" options={{ title: 'Inbox', headerShown: false }} />
        <Stack.Screen name="chat" options={{ headerShown: false }} />
        <Stack.Screen name="runs" options={{ title: 'Run Recap', headerShown: false }} />
        {__DEV__ && <Stack.Screen name="test-connection" options={{ title: 'Connection Test' }} />}
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      </BadgeProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

function RootLayout() {
  // Load custom brand fonts if available
  // Note: If font files don't exist, the SVG components will use fallback fonts
  // Download fonts from Google Fonts and place in assets/fonts/ directory
  const [fontsLoaded] = useFonts({
    // Uncomment these lines after adding font files to assets/fonts/
    // 'BarlowCondensed-ExtraBoldItalic': require('@/assets/fonts/BarlowCondensed-ExtraBoldItalic.ttf'),
    // 'BarlowCondensed-Bold': require('@/assets/fonts/BarlowCondensed-Bold.ttf'),
    // 'Rajdhani-Medium': require('@/assets/fonts/Rajdhani-Medium.ttf'),
    // 'Rajdhani-Regular': require('@/assets/fonts/Rajdhani-Regular.ttf'),
  });

  useEffect(() => {
    const hideSplash = () => {
      SplashScreen.hideAsync().catch(() => {
        // Ignore when native splash isn't registered (e.g. Expo Go, or view controller change)
      });
    };
    if (fontsLoaded) {
      hideSplash();
    } else {
      const timer = setTimeout(hideSplash, 500);
      return () => clearTimeout(timer);
    }
  }, [fontsLoaded]);

  const content = (
    <AuthProvider>
      <RootLayoutNavInner />
    </AuthProvider>
  );

  if (!POSTHOG_API_KEY) {
    warnPostHogKeyMissingOnce();
  }

  return (
    <ThemeProvider>
      {POSTHOG_API_KEY ? (
        <PostHogProvider
          apiKey={POSTHOG_API_KEY}
          options={{ host: POSTHOG_HOST }}
        >
          <PostHogBridge>
            {content}
          </PostHogBridge>
        </PostHogProvider>
      ) : (
        content
      )}
    </ThemeProvider>
  );
}

export default isSentryEnabled() ? Sentry.wrap(RootLayout) : RootLayout;
