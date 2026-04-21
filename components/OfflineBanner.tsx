import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { useThemeColors } from '@/contexts/theme-context';

const BANNER_LIGHT = { bg: '#FFF7ED', text: '#9A3412', border: '#FDBA74' };
const BANNER_DARK = { bg: '#3A2518', text: '#FDBA74', border: '#7C2D12' };

/**
 * Thin top banner when the device has no connection or no internet reachability.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeColors();

  const offline = isConnected === false || isInternetReachable === false;
  if (!offline) return null;

  const palette = isDark ? BANNER_DARK : BANNER_LIGHT;

  return (
    <View
      style={[
        styles.banner,
        {
          paddingTop: Math.max(insets.top, 8),
          backgroundColor: palette.bg,
          borderBottomColor: palette.border,
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={[styles.text, { color: palette.text }]}>
        {"You're offline — some features may be unavailable"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
  },
});
