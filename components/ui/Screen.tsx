import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';

type ScreenProps = {
  children: React.ReactNode;
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  paddingHorizontal?: number;
};

export function Screen({
  children,
  style,
  contentContainerStyle,
  paddingHorizontal = Spacing.lg,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useThemeColors();

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: colors.bg,
        },
        style,
      ]}
    >
      <View pointerEvents="box-none" style={[styles.content, { paddingHorizontal }, contentContainerStyle]}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});
