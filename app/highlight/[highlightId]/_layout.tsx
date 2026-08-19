import { Stack } from 'expo-router';

export default function HighlightIdLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="comments" />
    </Stack>
  );
}
