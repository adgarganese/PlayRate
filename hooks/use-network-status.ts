import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Live network state from NetInfo.
 * - isConnected: false when there is no network interface; null treated as unknown → optimistic true.
 * - isInternetReachable: false when connected but no internet; null while unknown.
 */
export function useNetworkStatus(): {
  isConnected: boolean;
  isInternetReachable: boolean | null;
} {
  const [isConnected, setIsConnected] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    const apply = (connected: boolean | null, reachable: boolean | null) => {
      if (cancelled) return;
      setIsConnected(connected !== false);
      setIsInternetReachable(reachable);
    };

    NetInfo.fetch()
      .then((state) => {
        apply(state.isConnected, state.isInternetReachable);
      })
      .catch(() => {
        apply(true, null);
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      apply(state.isConnected, state.isInternetReachable);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { isConnected, isInternetReachable };
}
