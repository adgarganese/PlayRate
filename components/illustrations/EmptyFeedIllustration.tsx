import Svg, { Path, Rect, Line } from 'react-native-svg';
import { useThemeColors } from '@/contexts/theme-context';

/** Minimal film strip + play hint — highlights feed empty. */
export function EmptyFeedIllustration() {
  const { colors } = useThemeColors();
  const muted = colors.textMuted;
  const accent = colors.accentPink;

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Rect x={18} y={28} width={84} height={64} rx={6} stroke={muted} strokeWidth={2.5} fill="none" />
      <Rect x={26} y={36} width={20} height={48} rx={2} stroke={muted} strokeWidth={2} fill="none" />
      <Path d="M 58 52 L 58 68 L 72 60 Z" fill="none" stroke={accent} strokeWidth={2.5} strokeLinejoin="round" />
      <Line x1={88} y1={44} x2={102} y2={44} stroke={accent} strokeWidth={2} strokeLinecap="round" />
      <Line x1={88} y1={56} x2={98} y2={56} stroke={accent} strokeWidth={2} strokeLinecap="round" />
      <Line x1={88} y1={68} x2={104} y2={68} stroke={muted} strokeWidth={1.5} strokeLinecap="round" opacity={0.7} />
    </Svg>
  );
}
