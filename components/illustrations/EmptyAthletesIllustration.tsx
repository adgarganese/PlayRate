import Svg, { Circle, Line, Path } from 'react-native-svg';
import { useThemeColors } from '@/contexts/theme-context';

/** Silhouettes + connection hint. */
export function EmptyAthletesIllustration() {
  const { colors } = useThemeColors();
  const muted = colors.textMuted;
  const accent = colors.accentElectric;

  return (
    <Svg width={120} height={120} viewBox="0 0 120 120">
      <Circle cx={34} cy={38} r={10} stroke={muted} strokeWidth={2} fill="none" />
      <Path d="M 22 78 Q 22 58 34 52 Q 46 58 46 78" stroke={muted} strokeWidth={2} fill="none" strokeLinecap="round" />
      <Line x1={54} y1={56} x2={66} y2={56} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <Line x1={60} y1={50} x2={60} y2={62} stroke={accent} strokeWidth={2.5} strokeLinecap="round" />
      <Circle cx={86} cy={38} r={10} stroke={muted} strokeWidth={2} fill="none" />
      <Path d="M 74 78 Q 74 58 86 52 Q 98 58 98 78" stroke={muted} strokeWidth={2} fill="none" strokeLinecap="round" />
    </Svg>
  );
}
