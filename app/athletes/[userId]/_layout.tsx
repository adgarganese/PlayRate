import { Stack } from 'expo-router';

export default function AthleteUserIdLayout() {
  return (
    <Stack screenOptions={{ gestureEnabled: true }}>
      <Stack.Screen name="index" options={{ title: 'Rate Athlete', headerShown: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', headerShown: false }} />
      <Stack.Screen name="highlights" options={{ title: 'Highlights', headerShown: false }} />
      <Stack.Screen name="followers" options={{ title: 'Followers', headerShown: false }} />
      <Stack.Screen name="following" options={{ title: 'Following' }} />
    </Stack>
  );
}
