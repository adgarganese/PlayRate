import { Redirect, useLocalSearchParams } from 'expo-router';

/**
 * Legacy in-tab URL. Detail lives on the root stack at `/highlight/[id]`
 * so Back / swipe returns to the origin tab instead of the Highlights feed.
 */
export default function LegacyHighlightDetailRedirect() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const id = Array.isArray(highlightId) ? highlightId[0] : highlightId;
  if (!id) return <Redirect href="/highlights" />;
  return <Redirect href={`/highlight/${id}`} />;
}
