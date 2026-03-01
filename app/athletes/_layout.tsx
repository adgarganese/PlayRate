import { Stack } from 'expo-router';

export default function AthletesLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: true }}>
      <Stack.Screen name="[userId]" options={{ headerShown: false }} />
    </Stack>
  );
}

