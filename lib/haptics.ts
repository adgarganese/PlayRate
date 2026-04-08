import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Light tap — likes, reposts, toggles */
export function hapticLight() {
  if (Platform.OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }
}

/** Medium tap — check-in success, publish, important confirmations */
export function hapticMedium() {
  if (Platform.OS === 'ios') {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

/** Success — completed actions */
export function hapticSuccess() {
  if (Platform.OS === 'ios') {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }
}

/** Selection tick — segment control changes, tab switches (already on tabs) */
export function hapticSelection() {
  if (Platform.OS === 'ios') {
    void Haptics.selectionAsync().catch(() => {});
  }
}

// --- Rating / onboarding buzz sequences (existing callers) ---

/** Play a single small buzz for initial rating */
export async function playInitialBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Play ascending buzz sequence (Light → Medium → Heavy, ~35ms gaps) */
export async function playAscendingBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
}

/** Play descending buzz sequence (Heavy → Medium → Light, ~35ms gaps) */
export async function playDescendingBuzz() {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 35));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * Stronger confirmation buzz for successful submit (ratings, etc.)
 * Uses notification feedback (success) + an extra light impact
 */
export async function playSubmitBuzz() {
  await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 50));
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
