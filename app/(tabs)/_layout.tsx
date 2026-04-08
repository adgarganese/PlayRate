/**
 * Tab shell: haptics, cross-fade between tabs, premium tab bar (blur / frosted surface, accent border, active indicator).
 */
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { hapticLight } from '@/lib/haptics';
import { useThemeColors } from '@/contexts/theme-context';

const ACCENT_PINK_TOP = 'rgba(255, 45, 85, 0.15)';
const TAB_BAR_EXTRA_TOP = 10;
const TAB_BAR_EXTRA_BOTTOM = 10;
const INDICATOR_WIDTH = 20;
const INDICATOR_HEIGHT = 3;
const INDICATOR_GAP = 4;

function TabBarBackground() {
  const { isDark } = useThemeColors();
  const tint = isDark ? 'dark' : 'light';
  const solidFallback = isDark ? 'rgba(26, 34, 56, 0.92)' : 'rgba(255, 255, 255, 0.92)';
  const iosTintOverlay = isDark ? 'rgba(26, 34, 56, 0.72)' : 'rgba(255, 255, 255, 0.78)';

  return (
    <View style={styles.tabBarBgRoot} pointerEvents="none">
      {Platform.OS === 'ios' ? (
        <>
          <BlurView intensity={72} tint={tint} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: iosTintOverlay }]} />
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: solidFallback }]} />
      )}
      <View style={styles.tabBarTopAccent} />
    </View>
  );
}

function TabBarIconWithIndicator({
  name,
  color,
  focused,
}: {
  name: React.ComponentProps<typeof IconSymbol>['name'];
  color: string;
  focused: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <View style={styles.tabIconColumn}>
      <IconSymbol size={28} name={name} color={color} />
      <View style={styles.indicatorSlot}>
        {focused ? (
          <View
            style={[
              styles.indicator,
              { backgroundColor: colors.accentPink },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, TAB_BAR_EXTRA_BOTTOM);
  const tabBarMinHeight = 58 + bottomPad + TAB_BAR_EXTRA_TOP;

  return (
    <Tabs
      screenListeners={{
        tabPress: () => {
          hapticLight();
        },
      }}
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        tabBarActiveTintColor: colors.accentPink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          borderTopWidth: 0,
          elevation: 0,
          backgroundColor: 'transparent',
          paddingTop: TAB_BAR_EXTRA_TOP,
          paddingBottom: bottomPad,
          minHeight: tabBarMinHeight,
        },
        tabBarBackground: () => <TabBarBackground />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabBarIconWithIndicator
              name="house.fill"
              color={focused ? colors.primary : colors.textMuted}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="highlights"
        options={{
          title: 'Highlights',
          tabBarAccessibilityLabel: 'Highlights',
          tabBarIcon: ({ focused }) => (
            <TabBarIconWithIndicator
              name="play.rectangle.fill"
              color={focused ? colors.primary : colors.textMuted}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="courts"
        options={{
          title: 'Courts',
          tabBarAccessibilityLabel: 'Courts',
          tabBarIcon: ({ focused }) => (
            <TabBarIconWithIndicator
              name="sportscourt.fill"
              color={focused ? colors.primary : colors.textMuted}
              focused={focused}
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
            <TabBarIconWithIndicator
              name="person.3.fill"
              color={focused ? colors.primary : colors.textMuted}
              focused={focused}
            />
          ),
        }}
      />
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarBgRoot: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  tabBarTopAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
    backgroundColor: ACCENT_PINK_TOP,
  },
  tabIconColumn: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  indicatorSlot: {
    marginTop: INDICATOR_GAP,
    height: INDICATOR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: INDICATOR_WIDTH,
  },
  indicator: {
    width: INDICATOR_WIDTH,
    height: INDICATOR_HEIGHT,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
});
