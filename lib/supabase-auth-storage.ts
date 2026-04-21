import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** expo-secure-store warns above this size and may throw in a future SDK. */
const SECURE_STORE_MAX_BYTES = 2048;

function utf8ByteLength(value: string): number {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(value).length;
  }
  return value.length;
}

/**
 * Supabase auth session storage: prefer Keychain / EncryptedSharedPreferences on native.
 * expo-secure-store may reject oversized values (~2048 bytes); then we fall back to AsyncStorage
 * and log once in dev (session still works, lower protection).
 */
export const supabaseAuthStorage = {
  getItem: async (key: string) => {
    if (Platform.OS === 'web') {
      return AsyncStorage.getItem(key);
    }
    try {
      const secure = await SecureStore.getItemAsync(key);
      if (secure != null) return secure;
    } catch {
      /* unavailable */
    }
    return AsyncStorage.getItem(key);
  },

  setItem: async (key: string, value: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.setItem(key, value);
      return;
    }
    if (utf8ByteLength(value) > SECURE_STORE_MAX_BYTES) {
      await AsyncStorage.setItem(key, value);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
      await AsyncStorage.removeItem(key);
    } catch {
      if (__DEV__) {
        console.warn(
          '[supabase] Auth session stored in AsyncStorage (SecureStore failed or value too large).'
        );
      }
      await AsyncStorage.setItem(key, value);
      try {
        await SecureStore.deleteItemAsync(key);
      } catch {
        /* ignore */
      }
    }
  },

  removeItem: async (key: string) => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      /* ignore */
    }
    await AsyncStorage.removeItem(key);
  },
};
