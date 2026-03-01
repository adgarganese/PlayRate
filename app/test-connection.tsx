import { Redirect } from 'expo-router';
import ConnectionTest from '../components/connection-test';

/** Connection Test is dev-only; redirect to home in production/beta. */
export default function TestConnectionScreen() {
  if (!__DEV__) {
    return <Redirect href="/(tabs)" />;
  }
  return <ConnectionTest />;
}

