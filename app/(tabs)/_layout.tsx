import { Tabs, useRouter } from 'expo-router';
import React from 'react';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/contexts/auth-context';
import { useThemeColors } from '@/contexts/theme-context';

export default function TabLayout() {
  const { colors, isDark } = useThemeColors();
  const { signOut } = useAuth();
  const router = useRouter();

  const handleErrorSignOut = React.useCallback(async () => {
    await signOut();
    router.replace('/sign-in');
  }, [signOut, router]);

  return (
    <AppErrorBoundary
      fallbackMessage="Something went wrong after signing in. Tap Try again to continue."
      onSignOut={handleErrorSignOut}>
    <Tabs
      screenListeners={{
        tabPress: () => {
          if (Platform.OS === 'ios') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }
        },
      }}
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: isDark ? colors.bg : colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          elevation: 9999,
          zIndex: 9999,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              size={28}
              name="house.fill"
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="highlights"
        options={{
          title: 'Highlights',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              size={28}
              name="play.rectangle.fill"
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="courts"
        options={{
          title: 'Courts',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              size={28}
              name="sportscourt.fill"
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="athletes/index"
        options={{
          title: 'Athletes',
          tabBarLabel: 'Athletes',
          tabBarAccessibilityLabel: 'Athletes',
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              name="person.3.fill"
              size={28}
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
    </AppErrorBoundary>
  );
}
