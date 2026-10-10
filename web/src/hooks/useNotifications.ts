import { useCallback, useEffect, useState } from "react";
import { useApp } from "@proappstore/sdk";
import { useAuthContext } from "./useAuthContext";
import {
  NotificationRepository,
  type NotificationWithId,
} from "../repositories/notificationRepository";

export const useNotifications = () => {
  const { currentUser } = useAuthContext();
  const app = useApp() as any;
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);

  const refresh = useCallback(async () => {
    if (!currentUser) return;
    try {
      setNotifications(await NotificationRepository.list());
    } catch {
      // Leave the last known list in place; another foreground refresh can retry.
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    let cancelled = false;

    // Initial fetch: load durable notification state from D1
    const loadInitial = async () => {
      await refresh();
    };
    void loadInitial();

    // User room subscription for real-time notification invalidations
    const room = app?.rooms?.join(`user:${currentUser.id}`);
    if (room) {
      // Listen to notification.created and inbox.changed events
      const unsubscribeEvent = room.onEvent((event: any) => {
        if (event.data?.type === 'notification.created' || event.data?.type === 'inbox.changed') {
          if (!cancelled) void refresh();
        }
      });

      // Refetch on reconnect (missed events during disconnect)
      const unsubscribeReconnect = room.onReconnect(() => {
        if (!cancelled) void refresh();
      });

      return () => {
        cancelled = true;
        unsubscribeEvent();
        unsubscribeReconnect();
        room.close();
      };
    } else {
      // Fallback: refresh on visibility change only
      const onVisible = () => {
        if (document.visibilityState === 'visible' && !cancelled) void refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        cancelled = true;
        document.removeEventListener('visibilitychange', onVisible);
      };
    }
  }, [currentUser?.id, refresh, app]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!currentUser) return;
    await NotificationRepository.markAsRead(currentUser.id, id);
    await refresh();
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    await NotificationRepository.markAllAsRead(currentUser.id, unreadIds);
    await refresh();
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead, refresh };
};
