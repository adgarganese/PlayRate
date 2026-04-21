import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { setProfileOnboardingCompleted } from '@/lib/onboarding-profile';

/**
 * Marks onboarding complete (idempotent) and replaces the stack with the main tabs.
 * Used for Skip on any step and for the final "Let's go" action.
 */
export function useOnboardingExit() {
  const router = useRouter();
  const { user } = useAuth();

  const exitToHome = useCallback(async () => {
    if (user?.id) {
      await setProfileOnboardingCompleted(user.id);
    }
    // Re-run root gate so beta terms (if not yet accepted) show before tabs.
    router.replace('/' as any);
  }, [router, user?.id]);

  return { exitToHome };
}
