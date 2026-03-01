import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { IconSymbol } from './icon-symbol';
import { useThemeColors } from '@/contexts/theme-context';
import { Spacing, Radius, Typography } from '@/constants/theme';

type ListItemProps = {
  title: string;
  subtitle?: string;
  /** Optional third line below subtitle (e.g. "Basketball • Shot Creator") */
  metadataLine?: string;
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
        <Text style={[Typography.bodyBold, styles.title, { color: colors.text }]}>
          {title}
        </Text>
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
  title: {
    marginBottom: Spacing.xs,
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
