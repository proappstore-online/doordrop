import type { NotificationData } from '../models/notification';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { fromWire } from '../lib/transform';

export type NotificationWithId = NotificationData & { id: string };

export const NotificationRepository = {
  // TODO(task #11): port to fas.rooms `notifications:{userId}` for push. Polling for now.
  subscribe(
    _userId: string,
    callback: (notifications: NotificationWithId[]) => void,
  ): () => void {
    let active = true;
    const tick = async () => {
      if (!active) return;
      try {
        const raw = await apiGet<unknown[]>('/v1/notifications');
        callback(raw.map((r) => fromWire<NotificationWithId>(r)));
      } catch {
        /* swallow */
      }
      if (active) setTimeout(tick, 5000);
    };
    void tick();
    return () => {
      active = false;
    };
  },

  async markAsRead(_userId: string, notificationId: string): Promise<void> {
    await apiPatch(`/v1/notifications/${notificationId}`, { read: true });
  },

  async markAllAsRead(_userId: string, _notificationIds: string[]): Promise<void> {
    // Worker has a bulk endpoint that ignores the id list and marks every unread notif for self.
    await apiPost('/v1/notifications/mark-all-read');
  },
};
