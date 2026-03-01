import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing } from '@/constants/theme';

const TAGLINE = 'Find runs. Get rated. Level up.';

type PlayRatePlaceholderProps = {
  style?: ViewStyle;
};

/**
 * Text placeholder for brand: PlayRate + tagline.
 * Center aligned, sleek; matches dark theme.
 */
export function PlayRatePlaceholder({ style }: PlayRatePlaceholderProps) {
  const { colors } = useThemeColors();

  return (
    <View style={[styles.container, style]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        PlayRate
      </Text>
      <Text style={[styles.tagline, { color: colors.textMuted }]}>
        {TAGLINE}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: 10,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
