import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

export type ProfileAuthGate = {
  needsOnboarding: boolean;
  /** True when profile row exists, onboarding is done, and terms have not been accepted in-app. */
  needsTerms: boolean;
};

/**
 * Single read for post-auth routing: onboarding first, then beta terms.
 * On read error: fail-closed to onboarding so we never skip terms/profile state silently.
 */
export async function fetchProfileAuthGate(userId: string): Promise<ProfileAuthGate> {
  const { data, error } = await supabase
    .from('profiles')
    .select('onboarding_completed, terms_accepted_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    logger.error('[onboarding-profile] gate read failed → routing to onboarding', { err: error, userId });
    return { needsOnboarding: true, needsTerms: false };
  }
  if (!data) {
    if (__DEV__) {
      logger.info('[onboarding-profile] no profile row → needs onboarding', { userId });
    }
    return { needsOnboarding: true, needsTerms: false };
  }
  const needsOnboarding = data.onboarding_completed !== true;
  const needsTerms = !needsOnboarding && data.terms_accepted_at == null;
  if (__DEV__) {
    logger.info('[onboarding-profile] gate', {
      userId,
      onboarding_completed: data.onboarding_completed,
      terms_accepted_at: data.terms_accepted_at,
      needsOnboarding,
      needsTerms,
    });
  }
  return { needsOnboarding, needsTerms };
}

export async function setProfileTermsAccepted(userId: string): Promise<boolean> {
  const acceptedAt = new Date().toISOString();
  const { error } = await supabase
    .from('profiles')
    .update({ terms_accepted_at: acceptedAt })
    .eq('user_id', userId);

  if (error) {
    logger.warn('[onboarding-profile] set terms_accepted_at failed', { err: error, userId });
    return false;
  }
  return true;
}

export async function setProfileOnboardingCompleted(userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('user_id', userId);

  if (error) {
    logger.warn('[onboarding-profile] set completed failed', { err: error, userId });
    return false;
  }
  return true;
}
