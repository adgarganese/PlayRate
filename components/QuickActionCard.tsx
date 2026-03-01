import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from './Card';
import { AppText } from './ui/AppText';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius } from '@/constants/theme';

// Possibly unused: not imported in app.
type QuickActionCardProps = {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
  iconColor?: string;
};

export function QuickActionCard({
  title,
  description,
  icon,
  onPress,
  iconColor,
}: QuickActionCardProps) {
  const { colors } = useThemeColors();
  const tintColor = iconColor || colors.primary;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: colors.surfaceAlt,
            },
          ]}
        >
          <IconSymbol name={icon as React.ComponentProps<typeof IconSymbol>['name']} size={24} color={tintColor} />
        </View>
        <View style={styles.content}>
          <AppText variant="bodyBold" color="text" style={styles.title}>
            {title}
          </AppText>
          <AppText variant="muted" color="textMuted" numberOfLines={2}>
            {description}
          </AppText>
        </View>
        <IconSymbol
          name="chevron.right"
          size={20}
          color={colors.textMuted}
        />
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: Radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.xs,
  },
});
