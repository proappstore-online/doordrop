import type { NotificationData } from '../models/notification';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { fromWire } from '../lib/transform';

export type NotificationWithId = NotificationData & { id: string };

export const NotificationRepository = {
  // Push handles timely alerts. The top bar fetches this on mount, focus and
  // when the bell opens; it must not spend the app-wide worker quota every 5s.
  async list(): Promise<NotificationWithId[]> {
    const raw = await apiGet<unknown[]>('/v1/notifications');
    return raw.map((r) => fromWire<NotificationWithId>(r));
  },

  async markAsRead(_userId: string, notificationId: string): Promise<void> {
    await apiPatch(`/v1/notifications/${notificationId}`, { read: true });
  },

  async markAllAsRead(_userId: string, _notificationIds: string[]): Promise<void> {
    // Worker has a bulk endpoint that ignores the id list and marks every unread notif for self.
    await apiPost('/v1/notifications/mark-all-read');
  },
};
