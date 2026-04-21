import { supabase } from './supabase';
import { logger } from './logger';
import { isRpcRateLimitError } from './rpc-rate-limit';

type CreateNotificationParams = {
  userId: string;
  actorId: string | null;
  type: string;
  entityType: string | null;
  entityId: string | null;
  title: string;
  body: string | null;
  metadata?: Record<string, unknown> | null;
};

/**
 * Inserts an in-app notification row via SECURITY DEFINER RPC.
 * Fire-and-forget: failures are logged and do not throw (primary UX already succeeded).
 */
export async function createInAppNotification(params: CreateNotificationParams): Promise<void> {
  const { error } = await supabase.rpc('create_notification', {
    p_user_id: params.userId,
    p_actor_id: params.actorId,
    p_type: params.type,
    p_entity_type: params.entityType,
    p_entity_id: params.entityId,
    p_title: params.title,
    p_body: params.body,
    p_metadata: params.metadata ?? null,
  });
  if (error) {
    if (isRpcRateLimitError(error)) {
      logger.warn('[createInAppNotification] rate limited', { type: params.type });
      return;
    }
    logger.warn('[createInAppNotification] rpc failed', { err: error, type: params.type });
  }
}
