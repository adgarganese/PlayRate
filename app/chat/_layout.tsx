import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: true }}>
      <Stack.Screen name="[conversationId]" options={{ headerShown: false }} />
    </Stack>
  );
}
