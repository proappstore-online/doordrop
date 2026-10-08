import { useCallback, useEffect, useState } from "react";
import { useAuthContext } from "./useAuthContext";
import {
  NotificationRepository,
  type NotificationWithId,
} from "../repositories/notificationRepository";

export const useNotifications = () => {
  const { currentUser } = useAuthContext();
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
    void refresh();

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentUser?.id, refresh]);

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
