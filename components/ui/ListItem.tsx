import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';
import { TierBadge } from './TierBadge';

type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Optional third line below subtitle (e.g. "Basketball • Shot Creator") */
  metadataLine?: string;
  /** `profiles.rep_level` — shows inline tier badge next to the title when ranked */
  tierRepLevel?: string | null;
  showChevron?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
};

export function ListItem({
  title,
  subtitle,
  metadataLine,
  tierRepLevel,
  showChevron = false,
  onPress,
  style,
  leftContent,
  rightContent,
}: ListItemProps) {
  const { colors } = useThemeColors();

  const content = (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>
      {leftContent && <View style={styles.leftContent}>{leftContent}</View>}
      <View style={styles.textContainer}>
        <View style={styles.titleRow}>
          <Text style={[Typography.bodyBold, styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          {tierRepLevel != null && tierRepLevel !== '' ? (
            <TierBadge tierName={tierRepLevel} size="sm" />
          ) : null}
        </View>
        {subtitle && (
          <Text style={[Typography.muted, styles.subtitle, { color: colors.textMuted }]}>
            {subtitle}
          </Text>
        )}
        {metadataLine ? (
          <Text style={[Typography.mutedSmall, styles.metadataLine, { color: colors.textMuted }]}>
            {metadataLine}
          </Text>
        ) : null}
      </View>
      {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
      {showChevron && (
        <IconSymbol
          name="chevron.right"
          size={20}
          color={colors.textMuted}
          style={styles.chevron}
        />
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  leftContent: {
    marginRight: Spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
    flexWrap: 'nowrap',
  },
  title: {
    flexShrink: 1,
    marginBottom: 0,
  },
  subtitle: {
    marginTop: 0,
  },
  metadataLine: {
    marginTop: 2,
  },
  rightContent: {
    marginLeft: Spacing.md,
  },
  chevron: {
    marginLeft: Spacing.sm,
  },
});
