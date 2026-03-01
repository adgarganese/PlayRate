import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/auth-context';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

/**
 * Auth gate: root entrypoint. Shows loading, then redirects to sign-in or tabs.
 * - Loading: minimal splash (no tabs)
 * - Not logged in: sign-in only (no tabs)
 * - Logged in: tabs (Home)
 */
export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!user) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}
