import { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { useBadges } from '@/contexts/badge-context';
import { useAuth } from '@/contexts/auth-context';
import { Spacing, Typography } from '@/constants/theme';

/**
 * Renders bell icon for Home and Profile headers.
 * Bell -> /inbox?tab=notifications
 * Badge count from BadgeContext (unread notifications, fallback to unread DMs).
 */
export function NotificationsAndInboxIcons() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useThemeColors();
  const { unreadDmCount, unreadNotifCount, refreshBadges } = useBadges();

  useFocusEffect(
    useCallback(() => {
      refreshBadges();
    }, [refreshBadges])
  );

  const onNotificationsPress = useCallback(() => {
    router.push('/inbox?tab=notifications');
  }, [router]);

  if (!user) return null;

  const notifBadgeCount = unreadNotifCount > 0 ? unreadNotifCount : unreadDmCount;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.touchable, pressed && styles.pressed]}
        onPress={onNotificationsPress}
        accessibilityLabel={notifBadgeCount > 0 ? `Notifications, ${notifBadgeCount} unread` : 'Notifications'}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={styles.iconWrap}>
          <IconSymbol name="bell.fill" size={24} color={colors.textMuted} />
          {notifBadgeCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {notifBadgeCount > 99 ? '99+' : notifBadgeCount}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    zIndex: 10,
  },
  touchable: {
    padding: Spacing.sm,
    marginTop: -Spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  iconWrap: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    ...Typography.mutedSmall,
    color: '#FFF',
    fontSize: 11,
    fontWeight: '600',
  },
});
