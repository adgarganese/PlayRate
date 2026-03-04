import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { ATHLETES_TAB_ROUTE } from '@/constants/routes';

export default function TabLayout() {
  const { colors, isDark } = useThemeColors();

  return (
    <Tabs
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
          tabBarButton: (props) => <HapticTab {...props} />,
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
          tabBarButton: (props) => <HapticTab {...props} />,
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
          tabBarButton: (props) => <HapticTab {...props} />,
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
          href: ATHLETES_TAB_ROUTE,
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarIcon: ({ focused }) => (
            <IconSymbol
              name="person.3.fill"
              size={28}
              color={focused ? colors.primary : colors.textMuted}
            />
          ),
        } as any}
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
  );
}
