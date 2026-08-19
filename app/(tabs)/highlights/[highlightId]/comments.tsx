import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacyHighlightCommentsRedirect() {
  const { highlightId } = useLocalSearchParams<{ highlightId: string }>();
  const id = Array.isArray(highlightId) ? highlightId[0] : highlightId;
  if (!id) return <Redirect href="/highlights" />;
  return <Redirect href={`/highlight/${id}/comments`} />;
}
