import { Stack } from 'expo-router';

export default function CourtsLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: true }}>
      <Stack.Screen name="index" options={{ title: 'Courts', headerShown: false }} />
      <Stack.Screen name="[courtId]" options={{ title: 'Court Details', headerShown: false }} />
      <Stack.Screen name="run/[runId]" options={{ title: 'Run', headerShown: false }} />
      <Stack.Screen name="new" options={{ title: 'Add Court', headerShown: false }} />
      <Stack.Screen name="send-dm" options={{ title: 'Send via DM' }} />
    </Stack>
  );
}

