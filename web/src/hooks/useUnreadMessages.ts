import { useState, useEffect } from 'react';
import { useApp } from '@proappstore/sdk';
import { useAuthContext } from './useAuthContext';
import { apiGet, ApiError } from '../lib/api';

// This badge is present on every signed-in page. Keep its refresh deliberately
// modest: detailed, near-real-time chat polling happens only on the chat page.
// The 5-minute interval (plus visibility-aware gating) ensures one idle tab
// consumes only ~288 requests/day, staying well below the 5,000/day app-worker quota.
// See #64: aggressive polling exhausted the quota in <24h before mitigation.
// Issue #68 adds real-time invalidation via user-room events; polling is a fallback.
const UNREAD_POLL_MS = 5 * 60_000;
const QUOTA_EXCEEDED_BACKOFF_MS = 30 * 60_000; // Back off for 30 minutes on 429

export function useUnreadMessages() {
  const { currentUser } = useAuthContext();
  const app = useApp() as any;
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setTotalUnread(0);
      return;
    }
    let cancelled = false;
    let backoffUntil = 0;

    const refresh = async () => {
      // A hidden tab does not need to keep the shared app-worker quota warm.
      if (document.visibilityState !== 'visible') return;
      // Back off if we recently hit quota exceeded.
      if (Date.now() < backoffUntil) return;
      try {
        const { unreadCount } = await apiGet<{ unreadCount: number }>('/v1/me/unread-messages');
        if (!cancelled) {
          setTotalUnread(unreadCount);
          // Reset backoff on success.
          backoffUntil = 0;
        }
      } catch (err) {
        // On quota exceeded (429), back off to avoid retry storms.
        if (err instanceof ApiError && err.status === 429) {
          backoffUntil = Date.now() + QUOTA_EXCEEDED_BACKOFF_MS;
        }
        /* swallow other errors */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };

    // Initial load
    void refresh();

    // User room subscription for real-time unread count invalidation
    const room = app?.rooms?.join(`user:${currentUser.id}`);
    let unsubscribeEvent: (() => void) | undefined;
    let unsubscribeReconnect: (() => void) | undefined;

    if (room) {
      // Listen to inbox.changed events (unread count changed)
      unsubscribeEvent = room.onEvent((event: any) => {
        if (event.data?.type === 'inbox.changed' && !cancelled) {
          void refresh();
        }
      });

      // Refetch on reconnect (missed events during disconnect)
      unsubscribeReconnect = room.onReconnect(() => {
        if (!cancelled) void refresh();
      });
    }

    // Polling as fallback (when rooms unavailable or on regular interval)
    const interval = setInterval(() => void refresh(), UNREAD_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      if (unsubscribeEvent) unsubscribeEvent();
      if (unsubscribeReconnect) unsubscribeReconnect();
      if (room) room.close();
    };
  }, [currentUser?.id, app]);

  return { totalUnread };
}
