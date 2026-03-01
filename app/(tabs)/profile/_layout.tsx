import { Stack } from 'expo-router';

export default function ProfileLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="highlights" options={{ title: 'My Highlights' }} />
      <Stack.Screen name="account" options={{ title: 'Account & Security' }} />
    </Stack>
  );
}
