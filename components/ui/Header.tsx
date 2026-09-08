import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from './icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

function borderColorAtOpacity(borderHex: string, opacity: number): string {
  const hex = borderHex.replace('#', '');
  if (hex.length !== 6) return borderHex;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return borderHex;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

type HeaderProps = {
  title: string;
  /** When set, replaces the default title + subtitle block. */
  customTitle?: React.ReactNode;
  subtitle?: string;
  /** When true, subtitle uses logo-tagline typography (fontSize 14, fontWeight 500, letterSpacing 0.5, marginTop Spacing.sm). */
  subtitleTagline?: boolean;
  showBack?: boolean;
  /** Optional custom back handler; when not set, uses router.back(). */
  onBackPress?: () => void;
  /** Custom right-side content (e.g. Inbox icon + Edit). When set, rightIcon is ignored. */
  rightElement?: React.ReactNode;
  rightIcon?: {
    name: string;
    onPress: () => void;
    accessibilityLabel?: string;
  };
  style?: ViewStyle;
};

export function Header({
  title,
  subtitle,
  customTitle,
  subtitleTagline = false,
  showBack = true,
  onBackPress,
  rightElement,
  rightIcon,
  style,
}: HeaderProps) {
  const router = useRouter();
  const { colors } = useThemeColors();
  const handleBack = onBackPress ?? (() => router.back());

  const rightContent = rightElement ?? (rightIcon ? (
    <TouchableOpacity
      style={styles.rightButton}
      onPress={rightIcon.onPress}
      accessibilityLabel={rightIcon.accessibilityLabel || 'Action'}
      accessibilityRole="button"
      hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
    >
      <IconSymbol
        name={rightIcon.name as React.ComponentProps<typeof IconSymbol>['name']}
        size={24}
        color={colors.textMuted}
      />
    </TouchableOpacity>
  ) : null);

  const headerChrome = {
    borderBottomWidth: StyleSheet.hairlineWidth * 2,
    borderBottomColor: borderColorAtOpacity(colors.border, 0.5),
  };

  const subtitleEl = !customTitle && subtitle ? (
    <Text
      style={[
        subtitleTagline ? styles.subtitleTagline : [Typography.muted, styles.subtitle],
        { color: colors.textMuted },
        showBack ? styles.subtitleIndent : null,
      ]}
    >
      {subtitle}
    </Text>
  ) : null;

  return (
    <View style={[styles.container, headerChrome, style]}>
      <View style={styles.titleRow}>
        <View style={styles.leftSection}>
          {showBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={handleBack}
              accessibilityLabel="Go back"
              accessibilityRole="button"
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
            >
              <IconSymbol
                name="chevron.left"
                size={12}
                color={colors.text}
              />
            </TouchableOpacity>
          )}
          <View style={styles.titleContainer}>
            {customTitle ?? (
              <Text
                style={[Typography.h2, styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                {title}
              </Text>
            )}
          </View>
        </View>
        {rightContent ? <View style={styles.rightCluster}>{rightContent}</View> : null}
      </View>
      {subtitleEl}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    minHeight: 56,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    width: 44,
    height: 44,
    marginRight: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleContainer: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    marginTop: Spacing.xs,
  },
  subtitleIndent: {
    paddingLeft: 44 + Spacing.sm,
  },
  /** Matches PlayRatePlaceholder tagline: fontSize 14, fontWeight 500, letterSpacing 0.5, marginTop Spacing.sm */
  subtitleTagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    includeFontPadding: false,
  },
  rightCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  rightButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
