import { Stack } from 'expo-router';

export default function HighlightsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="send-dm" options={{ title: 'Send via DM' }} />
      <Stack.Screen name="[highlightId]/index" />
      <Stack.Screen name="[highlightId]/comments" />
    </Stack>
  );
}
