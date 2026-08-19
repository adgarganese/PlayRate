import { Stack } from 'expo-router';

export default function HighlightOverlayLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="[highlightId]" />
    </Stack>
  );
}
