import { AppState, InteractionManager, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { supabase } from './supabase';
import { logger } from './logger';
import { track } from './analytics';

const STORED_PUSH_TOKEN_KEY = '@playrate_expo_push_token';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

function getExpoProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra ?? (Constants.manifest as { extra?: { eas?: { projectId?: string } } })?.extra;
  return extra?.eas?.projectId;
}

function platformLabel(): 'ios' | 'android' | 'web' | 'unknown' {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  if (Platform.OS === 'web') return 'web';
  return 'unknown';
}

/**
 * Requests permission, registers with Expo, and upserts the token for the signed-in user.
 * No-op on simulator / denied permission / missing project id (does not block the app).
 */
export async function registerForPushNotifications(userId: string): Promise<void> {
  if (!Device.isDevice) {
    return;
  }

  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = getExpoProjectId();
    if (!projectId) {
      if (__DEV__) logger.warn('[push] Missing EAS projectId in app config; cannot get Expo push token');
      return;
    }

    const tokenRes = await Notifications.getExpoPushTokenAsync({ projectId });
    const pushToken = tokenRes.data;
    if (!pushToken) return;

    const platform = platformLabel();
    const now = new Date().toISOString();
    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        push_token: pushToken,
        platform,
        updated_at: now,
      },
      { onConflict: 'user_id,push_token' }
    );

    if (error) {
      if (__DEV__) logger.warn('[push] upsert device_push_tokens failed', { err: error });
      return;
    }

    await AsyncStorage.setItem(STORED_PUSH_TOKEN_KEY, pushToken);
  } catch (err) {
    if (__DEV__) logger.warn('[push] registerForPushNotifications', { err });
  }
}

/** Removes this device's token from Supabase (call before sign-out while session is still valid). */
export async function unregisterPushToken(): Promise<void> {
  try {
    const pushToken = await AsyncStorage.getItem(STORED_PUSH_TOKEN_KEY);
    if (!pushToken) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
      return;
    }

    const { error } = await supabase
      .from('device_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('push_token', pushToken);

    if (error && __DEV__) {
      logger.warn('[push] unregister delete failed', { err: error });
    }
    await AsyncStorage.removeItem(STORED_PUSH_TOKEN_KEY);
  } catch (err) {
    if (__DEV__) logger.warn('[push] unregisterPushToken', { err });
  }
}

/** Typed routes use a narrow `push`; notification routing uses dynamic paths. */
type ExpoRouterLike = { push: (href: any) => void };

/** Avoid double `push` when both cold-start replay and the response listener fire for the same open. */
const OPEN_DEDUP_MS = 2500;
let lastOpenKey = '';
let lastOpenAt = 0;

function pushNotificationDeepLinkTarget(raw: Record<string, unknown>): string | null {
  const type = String(raw.type ?? '');
  const entityId = raw.entity_id != null && raw.entity_id !== '' ? String(raw.entity_id) : null;
  const actorId = raw.actor_id != null && raw.actor_id !== '' ? String(raw.actor_id) : null;

  if (
    type === 'highlight_like' ||
    type === 'highlight_comment' ||
    type === 'highlight_repost' ||
    type === 'repost'
  ) {
    return entityId ? `/highlights/${entityId}` : null;
  }
  if (type === 'new_message') {
    return entityId ? `/chat/${entityId}` : null;
  }
  if (type === 'new_follower') {
    const profileUserId = entityId ?? actorId;
    return profileUserId ? `/athletes/${profileUserId}/profile` : null;
  }
  if (type === 'cosign') {
    const profileUserId = actorId ?? entityId;
    return profileUserId ? `/athletes/${profileUserId}/profile` : null;
  }
  if (type === 'run_join') {
    return entityId ? `/courts/run/${entityId}` : null;
  }
  return type ? `push:${type}` : null;
}

function navigateFromNotificationData(router: ExpoRouterLike, raw: Record<string, unknown>): void {
  const type = String(raw.type ?? '');
  const entityId = raw.entity_id != null && raw.entity_id !== '' ? String(raw.entity_id) : null;
  const actorId = raw.actor_id != null && raw.actor_id !== '' ? String(raw.actor_id) : null;

  const dedupeKey = `${type}|${entityId ?? ''}|${actorId ?? ''}`;
  const now = Date.now();
  if (dedupeKey === lastOpenKey && now - lastOpenAt < OPEN_DEDUP_MS) {
    return;
  }
  lastOpenKey = dedupeKey;
  lastOpenAt = now;

  const deepLinkTarget = pushNotificationDeepLinkTarget(raw);
  if (deepLinkTarget) {
    track('notification_opened', {
      notification_type: 'push',
      deep_link_target: deepLinkTarget,
    });
  }

  if (
    type === 'highlight_like' ||
    type === 'highlight_comment' ||
    type === 'highlight_repost' ||
    type === 'repost'
  ) {
    if (entityId) router.push(`/highlights/${entityId}` as any);
    return;
  }

  if (type === 'new_message') {
    if (entityId) router.push(`/chat/${entityId}` as any);
    return;
  }

  if (type === 'new_follower') {
    const profileUserId = entityId ?? actorId;
    if (profileUserId) router.push(`/athletes/${profileUserId}/profile` as any);
    return;
  }

  if (type === 'cosign') {
    const profileUserId = actorId ?? entityId;
    if (profileUserId) router.push(`/athletes/${profileUserId}/profile` as any);
    return;
  }

  if (type === 'run_join') {
    if (entityId) router.push(`/courts/run/${entityId}` as any);
  }
}

function handleNotificationOpen(
  router: ExpoRouterLike,
  response: Notifications.NotificationResponse | null
): void {
  if (!response) return;
  const data = response.notification.request.content.data as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') return;
  navigateFromNotificationData(router, data);
}

/**
 * Subscribes to notification opens (foreground tap + background) and replays cold-start open once.
 */
export function subscribeToPushNotificationResponses(router: ExpoRouterLike): () => void {
  void Notifications.getLastNotificationResponseAsync().then((last) => {
    if (!last) return;
    const data = last.notification.request.content.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== 'object') return;

    // Cold start: router may not be ready on first tick; wait for interactions + a short delay.
    InteractionManager.runAfterInteractions(() => {
      setTimeout(() => {
        navigateFromNotificationData(router, data);
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          /* optional native API */
        }
      }, 400);
    });
  });

  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    handleNotificationOpen(router, response);
  });

  return () => sub.remove();
}

export function subscribeForegroundPushResume(
  userId: string | null | undefined,
  authLoading: boolean
): () => void {
  const sub = AppState.addEventListener('change', (next) => {
    if (next === 'active' && userId && !authLoading) {
      void registerForPushNotifications(userId);
    }
  });
  return () => sub.remove();
}
