import { useState, useEffect } from 'react';
import { useAuthContext } from './useAuthContext';
import { apiGet } from '../lib/api';

// This badge is present on every signed-in page. Keep its refresh deliberately
// modest: detailed, near-real-time chat polling happens only on the chat page.
const UNREAD_POLL_MS = 5 * 60_000;

export function useUnreadMessages() {
  const { currentUser } = useAuthContext();
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    if (!currentUser) {
      setTotalUnread(0);
      return;
    }
    let cancelled = false;

    const refresh = async () => {
      // A hidden tab does not need to keep the shared app-worker quota warm.
      if (document.visibilityState !== 'visible') return;
      try {
        const { unreadCount } = await apiGet<{ unreadCount: number }>('/v1/me/unread-messages');
        if (!cancelled) setTotalUnread(unreadCount);
      } catch {
        /* swallow */
      }
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    void refresh();
    const interval = setInterval(() => void refresh(), UNREAD_POLL_MS);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentUser?.id]);

  return { totalUnread };
}
