import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { getUnreadCount } from '@/lib/dms';
import { getUnreadNotificationCount } from '@/lib/notifications';
import { logger } from '@/lib/logger';

type BadgeContextValue = {
  unreadDmCount: number;
  unreadNotifCount: number;
  refreshBadges: () => Promise<void>;
};

const BadgeContext = createContext<BadgeContextValue | null>(null);

export function useBadges(): BadgeContextValue {
  const ctx = useContext(BadgeContext);
  if (!ctx) {
    return {
      unreadDmCount: 0,
      unreadNotifCount: 0,
      refreshBadges: async () => {},
    };
  }
  return ctx;
}

type BadgeProviderProps = { children: React.ReactNode; userId: string | null };

export function BadgeProvider({ children, userId }: BadgeProviderProps) {
  const [unreadDmCount, setUnreadDmCount] = useState(0);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshBadges = useCallback(async () => {
    if (!userId) {
      setUnreadDmCount(0);
      setUnreadNotifCount(0);
      return;
    }
    try {
      const [dm, notif] = await Promise.all([
        getUnreadCount(userId),
        getUnreadNotificationCount(userId),
      ]);
      setUnreadDmCount(dm);
      setUnreadNotifCount(notif);
      if (__DEV__) {
        logger.info('[Badge] refresh', { dm, notif });
      }
    } catch (e) {
      if (__DEV__) console.warn('[Badge] refresh failed', e);
      setUnreadDmCount(0);
      setUnreadNotifCount(0);
    }
  }, [userId]);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`badges:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => { refreshBadges(); }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => { refreshBadges(); }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `user_id=eq.${userId}` },
        () => { refreshBadges(); }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [userId, refreshBadges]);

  const value = useMemo(
    (): BadgeContextValue => ({
      unreadDmCount,
      unreadNotifCount,
      refreshBadges,
    }),
    [unreadDmCount, unreadNotifCount, refreshBadges]
  );

  return <BadgeContext.Provider value={value}>{children}</BadgeContext.Provider>;
}
