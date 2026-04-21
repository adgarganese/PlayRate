import { useEffect, useRef, useState } from 'react';
import { Redirect, type Href } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { logBootIndexRoute } from '@/lib/boot-log';
import { fetchProfileAuthGate } from '@/lib/onboarding-profile';
import { logger } from '@/lib/logger';

/**
 * Auth gate: root entrypoint. Shows loading, then redirects to sign-in, onboarding, or tabs.
 * - Loading: minimal splash (no tabs)
 * - Not logged in: sign-in only (no tabs)
 * - Logged in + onboarding incomplete: /onboarding
 * - Logged in + onboarding complete + terms not accepted: /terms
 * - Logged in + onboarding complete + terms accepted: tabs (Home)
 */
export default function Index() {
  const { user, loading } = useAuth();
  const loggedIndexDecision = useRef(false);
  const [onboardingResolved, setOnboardingResolved] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [needsTerms, setNeedsTerms] = useState(false);

  useEffect(() => {
    if (!__DEV__ || loading) return;
    if (loggedIndexDecision.current) return;
    loggedIndexDecision.current = true;
    logBootIndexRoute(user ? '(tabs)' : 'sign-in');
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setNeedsOnboarding(false);
      setOnboardingResolved(true);
      return;
    }
    setOnboardingResolved(false);
    let cancelled = false;
    if (__DEV__) {
      logger.info('[index-onboarding] checking gate', { userId: user.id });
    }
    void fetchProfileAuthGate(user.id).then((gate) => {
      if (!cancelled) {
        if (__DEV__) {
          logger.info('[index-onboarding] gate result', {
            userId: user.id,
            needsOnboarding: gate.needsOnboarding,
            needsTerms: gate.needsTerms,
            redirect: gate.needsOnboarding ? '/onboarding' : gate.needsTerms ? '/terms' : '/(tabs)',
          });
        }
        setNeedsOnboarding(gate.needsOnboarding);
        setNeedsTerms(gate.needsTerms);
        setOnboardingResolved(true);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only `user?.id` should refetch onboarding; full `user` identity changes without id change should not re-query
  }, [loading, user?.id]);

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  if (!onboardingResolved) {
    return <LoadingScreen message="Loading..." />;
  }

  if (needsOnboarding) {
    return <Redirect href="/onboarding" />;
  }

  if (needsTerms) {
    // `app/terms.tsx` exists; typed-route union may omit it until Expo regenerates link types.
    return <Redirect href={'/terms' as Href} />;
  }

  return <Redirect href="/(tabs)" />;
}
