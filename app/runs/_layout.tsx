import { Stack } from 'expo-router';

export default function RunsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="[id]/recap" options={{ title: 'Run Recap' }} />
    </Stack>
  );
}
