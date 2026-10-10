import React, { useEffect, useState } from 'react';

interface ConnectionBannerProps {
  alwaysShow?: boolean;
}

const ConnectionBanner: React.FC<ConnectionBannerProps> = ({ alwaysShow = false }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !alwaysShow) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-sm font-medium flex items-center gap-2 ${
        isOnline
          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
          : 'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      }`}
      style={{ paddingTop: `max(env(safe-area-inset-top, 0px) + 0.5rem, 0.5rem)` }}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <svg
        className="w-4 h-4 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
        role="img"
        aria-hidden="true"
      >
        {isOnline ? (
          <path
            fillRule="evenodd"
            d="M4.431 6.694a1 1 0 00-1.748.961 10.033 10.033 0 0015.634 0 1 1 0 00-1.748-.961 8.033 8.033 0 01-12.138 0zm0 3.5a1 1 0 00-1.748.961 10.033 10.033 0 0015.634 0 1 1 0 00-1.748-.961 8.033 8.033 0 01-12.138 0zM10 15a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        ) : (
          <path
            fillRule="evenodd"
            d="M5.05 4.05a7 7 0 119.9 9.9L9.9 4.05zM9 13a1 1 0 100-2 1 1 0 000 2z"
            clipRule="evenodd"
          />
        )}
      </svg>
      <span>{isOnline ? 'Back online' : 'Offline mode'}</span>
    </div>
  );
};

export default ConnectionBanner;
