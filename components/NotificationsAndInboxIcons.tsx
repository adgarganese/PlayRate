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
 * Renders inbox icon for Home and Profile headers.
 * Opens Inbox with Messages tab (user can switch to Notifications there).
 * Badge count from BadgeContext (unread DMs, fallback to unread notifications).
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

  const onInboxPress = useCallback(() => {
    router.push('/inbox');
  }, [router]);

  if (!user) return null;

  const inboxBadgeCount = unreadDmCount > 0 ? unreadDmCount : unreadNotifCount;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <Pressable
        style={({ pressed }) => [styles.touchable, pressed && styles.pressed]}
        onPress={onInboxPress}
        accessibilityLabel={inboxBadgeCount > 0 ? `Messages, ${inboxBadgeCount} unread` : 'Messages'}
        accessibilityRole="button"
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <View style={styles.iconWrap}>
          <IconSymbol name="bell.fill" size={24} color={colors.textMuted} />
          {inboxBadgeCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.primary }]}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {inboxBadgeCount > 99 ? '99+' : inboxBadgeCount}
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
