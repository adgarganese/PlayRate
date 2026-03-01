import { Stack } from 'expo-router';

export default function ProfileHighlightsLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: true }}>
      <Stack.Screen name="index" options={{ title: 'My Highlights', headerShown: false }} />
      <Stack.Screen name="[highlightId]" options={{ title: 'Highlight' }} />
    </Stack>
  );
}
