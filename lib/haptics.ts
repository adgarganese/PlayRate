import * as Haptics from 'expo-haptics';

/**
 * Play a single small buzz for initial rating
 */
export async function playInitialBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Play ascending buzz sequence (Light → Medium → Heavy, ~35ms gaps)
 */
export async function playAscendingBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  await new Promise(resolve => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await new Promise(resolve => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/**
 * Play descending buzz sequence (Heavy → Medium → Light, ~35ms gaps)
 */
export async function playDescendingBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await new Promise(resolve => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  await new Promise(resolve => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/**
 * Play a stronger confirmation buzz for successful submit
 * Uses notification feedback (success) + an extra light impact
 */
export async function playSubmitBuzz() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  await new Promise(resolve => setTimeout(resolve, 50));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
