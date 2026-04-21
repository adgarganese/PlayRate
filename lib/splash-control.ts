import * as SplashScreen from 'expo-splash-screen';

let splashHidden = false;

/** Idempotent hide for native splash (boot gate + ErrorBoundary). */
export function hideSplashOnce(): void {
  if (splashHidden) return;
  splashHidden = true;
  SplashScreen.hideAsync().catch(() => {});
}
