import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { IconSymbol } from './icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Typography } from '@/constants/theme';

type HeaderProps = {
  title: string;
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
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <IconSymbol
        name={rightIcon.name as React.ComponentProps<typeof IconSymbol>['name']}
        size={24}
        color={colors.textMuted}
      />
    </TouchableOpacity>
  ) : null);

  return (
    <View style={[styles.container, style]}>
      <View style={styles.leftSection}>
        {showBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleBack}
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
              <Text style={[Typography.h1, styles.title, { color: colors.text }]}>
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
    padding: Spacing.sm,
    marginRight: Spacing.sm,
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
    padding: Spacing.sm,
    marginTop: -Spacing.sm,
  },
});
