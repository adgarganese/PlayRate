import { ListItem } from './ui/ListItem';

type RunListItemProps = {
  courtName: string;
  distance: string;
  /** Omit or pass undefined to hide (e.g. court-based recommendations with no run time). */
  startTime?: string;
  /** Omit or pass undefined to hide (e.g. court-based recommendations with no run spots). */
  spotsLeft?: number;
  onPress: () => void;
};

export function RunListItem({
  courtName,
  distance,
  startTime,
  spotsLeft,
  onPress,
}: RunListItemProps) {
  const parts = [distance];
  if (startTime != null && startTime !== '') parts.push(`starts ${startTime}`);
  if (spotsLeft != null) parts.push(`${spotsLeft} spots left`);
  const subtitle = parts.join(' • ');
  const showMicroLabel = startTime == null && spotsLeft == null;

  return (
    <ListItem
      title={courtName}
      subtitle={subtitle}
      metadataLine={showMicroLabel ? 'Tap to view runs at this court' : undefined}
      showChevron
      onPress={onPress}
    />
  );
}
