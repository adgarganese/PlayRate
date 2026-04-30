import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Slider from '@react-native-community/slider';
import { useThemeColors } from '@/contexts/theme-context';
import { AppText } from '@/components/ui/AppText';
import { Spacing } from '@/constants/theme';

type Props = {
  /** Current value (1–10) or null when no rating yet */
  value: number | null;
  /** Called on every step change. Wire haptics in parent if needed. */
  onValueChange: (value: number) => void;
  /** Optional label shown above the slider (e.g. attribute name) */
  label?: string;
  /** Disable interaction (e.g. while saving) */
  disabled?: boolean;
  /** Style override for outer container */
  style?: StyleProp<ViewStyle>;
};

const MIN = 1;
const MAX = 10;
const STEP = 1;

export function RatingSlider({
  value,
  onValueChange,
  label,
  disabled = false,
  style,
}: Props) {
  const { colors } = useThemeColors();
  const displayValue = value ?? Math.round((MIN + MAX) / 2);
  const hasValue = value != null;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        {label ? (
          <AppText variant="mutedSmall" color="text" style={styles.label}>
            {label}
          </AppText>
        ) : null}
        <AppText
          variant="mutedSmall"
          color={hasValue ? 'primary' : 'textMuted'}
          style={styles.valueText}
        >
          {hasValue ? `${value}/10` : '—'}
        </AppText>
      </View>
      <Slider
        minimumValue={MIN}
        maximumValue={MAX}
        step={STEP}
        value={displayValue}
        onValueChange={(v) => {
          const rounded = Math.round(v);
          onValueChange(rounded);
        }}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.border}
        thumbTintColor={colors.primary}
        disabled={disabled}
        accessibilityLabel={label ? `${label} rating slider` : 'Rating slider'}
        accessibilityValue={{ min: MIN, max: MAX, now: displayValue }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  label: {
    flex: 1,
  },
  valueText: {
    minWidth: 40,
    textAlign: 'right',
  },
});
