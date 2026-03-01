import { supabase } from './supabase';

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
  metadata: Record<string, unknown> | null;
};

/**
 * List notifications for the current user, newest first.
 * Returns [] if the notifications table does not exist yet (migration not run).
 */
export async function listNotifications(userId: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, actor_id, type, entity_type, entity_id, title, body, created_at, read_at, metadata')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('notifications')) {
      return [];
    }
    throw error;
  }
  return (data || []) as NotificationRow[];
}

/**
 * Unread count for the bell badge.
 * Returns 0 if the notifications table does not exist yet (migration not run).
 */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error) {
    if (error.code === 'PGRST205' || error.message?.includes('notifications')) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

/**
 * Mark a single notification as read.
 * No-op if the notifications table does not exist.
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);
  if (error && error.code !== 'PGRST205' && !error.message?.includes('notifications')) {
    throw error;
  }
}

/**
 * Mark all notifications as read for the user.
 * No-op if the notifications table does not exist.
 */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null);
  if (error && error.code !== 'PGRST205' && !error.message?.includes('notifications')) {
    throw error;
  }
}
