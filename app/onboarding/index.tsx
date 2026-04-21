import { Redirect } from 'expo-router';

export default function OnboardingEntry() {
  return <Redirect href={'/onboarding/sports' as any} />;
}
