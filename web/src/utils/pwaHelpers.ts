/**
 * PWA helper utilities for service worker and wake lock
 */

let wakeLock: WakeLockSentinel | null = null;

/**
 * Register the service worker
 */
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      console.log('[PWA] Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  }
}

/**
 * Request wake lock to keep screen on during tracking
 */
export async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      console.log('[PWA] Wake lock acquired');
      
      wakeLock.addEventListener('release', () => {
        console.log('[PWA] Wake lock released');
      });
      
      return wakeLock;
    } catch (error) {
      console.error('[PWA] Wake lock request failed:', error);
    }
  } else {
    console.warn('[PWA] Wake Lock API not supported');
  }
}

/**
 * Release wake lock
 */
export async function releaseWakeLock() {
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log('[PWA] Wake lock released manually');
    } catch (error) {
      console.error('[PWA] Wake lock release failed:', error);
    }
  }
}

/**
 * Check if app is installed as PWA
 */
export function isPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://')
  );
}

/**
 * Request background sync permission
 */
export async function registerBackgroundSync(tag: string = 'sync-tracking-data') {
  if ('serviceWorker' in navigator && 'sync' in ServiceWorkerRegistration.prototype) {
    try {
      const registration = await navigator.serviceWorker.ready;
      await (registration as any).sync.register(tag);
      console.log('[PWA] Background sync registered:', tag);
      return true;
    } catch (error) {
      console.error('[PWA] Background sync registration failed:', error);
      return false;
    }
  } else {
    console.warn('[PWA] Background Sync API not supported');
    return false;
  }
}

/**
 * Keep the app active in background (best effort)
 */
export function keepAppActive() {
  // Request wake lock if supported
  requestWakeLock();
  
  // Re-request wake lock on visibility change
  document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && !wakeLock) {
      await requestWakeLock();
    }
  });
  
  // Keep a periodic heartbeat to prevent app suspension
  let heartbeatInterval: number | null = null;
  
  const startHeartbeat = () => {
    if (heartbeatInterval) return;
    heartbeatInterval = window.setInterval(() => {
      // Minimal activity to keep JS context alive
      console.log('[PWA] Heartbeat');
    }, 30000); // Every 30 seconds
  };
  
  const stopHeartbeat = () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  };
  
  startHeartbeat();
  
  return {
    stop: () => {
      stopHeartbeat();
      releaseWakeLock();
    }
  };
}
