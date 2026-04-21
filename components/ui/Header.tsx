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

  return (
    <View style={[styles.container, headerChrome, style]}>
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
            <>
              <Text
                style={[Typography.h2, styles.title, { color: colors.text }]}
                accessibilityRole="header"
              >
                {title}
              </Text>
              {subtitle && (
                <Text
                  style={
                    subtitleTagline
                      ? [styles.subtitleTagline, { color: colors.textMuted }]
                      : [Typography.muted, styles.subtitle, { color: colors.textMuted }]
                  }
                >
                  {subtitle}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
      {rightContent}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    minHeight: 56,
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
  },
  title: {
    marginBottom: Spacing.xs,
  },
  subtitle: {
    marginTop: 0,
  },
  /** Matches PlayRatePlaceholder tagline: fontSize 14, fontWeight 500, letterSpacing 0.5, marginTop Spacing.sm */
  subtitleTagline: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    includeFontPadding: false,
  },
  rightButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -Spacing.sm,
  },
});
