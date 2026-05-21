import { useEffect, useState } from "react";
import { useAuthContext } from "./useAuthContext";
import {
  NotificationRepository,
  type NotificationWithId,
} from "../repositories/notificationRepository";

export const useNotifications = () => {
  const { currentUser } = useAuthContext();
  const [notifications, setNotifications] = useState<NotificationWithId[]>([]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    const unsub = NotificationRepository.subscribe(currentUser.id, setNotifications);
    return () => unsub();
  }, [currentUser]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = (id: string) => {
    if (!currentUser) return;
    NotificationRepository.markAsRead(currentUser.id, id);
  };

  const markAllAsRead = () => {
    if (!currentUser) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    NotificationRepository.markAllAsRead(currentUser.id, unreadIds);
  };

  return { notifications, unreadCount, markAsRead, markAllAsRead };
};
