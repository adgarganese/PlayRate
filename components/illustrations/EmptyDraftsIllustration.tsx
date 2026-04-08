/**
 * Not wired in UI: drafts strip is omitted when there are no drafts.
 * Exported from `@/components/illustrations` for a future empty-drafts state.
 */
import Svg, { Rect, Line, Path } from 'react-native-svg';
import { useThemeColors } from '@/contexts/theme-context';

/** Document + dashed “in progress” frame. */
export function EmptyDraftsIllustration() {
  const { colors } = useThemeColors();
  const muted = colors.textMuted;
  const accent = colors.accentElectric;

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Rect x={28} y={30} width={64} height={72} rx={6} stroke={muted} strokeWidth={2} fill="none" />
      <Rect
        x={36}
        y={40}
        width={48}
        height={40}
        rx={4}
        stroke={accent}
        strokeWidth={2}
        fill="none"
        strokeDasharray="5 5"
      />
      <Line x1={40} y1={52} x2={68} y2={52} stroke={muted} strokeWidth={1.5} strokeLinecap="round" />
      <Line x1={40} y1={62} x2={62} y2={62} stroke={muted} strokeWidth={1.5} strokeLinecap="round" />
      <Path d="M 82 78 L 94 66" stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={88} y1={62} x2={96} y2={70} stroke={accent} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}
