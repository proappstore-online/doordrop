import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import type { BottomNavItem } from './BottomNav';
import BottomNav from './BottomNav';
import ConnectionBanner from './ConnectionBanner';

const WalkerLayout: React.FC = () => {
  const location = useLocation();

  const bottomNavItems: BottomNavItem[] = [
    {
      path: '/walker',
      label: 'Jobs',
      ariaLabel: 'Browse available jobs',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      ),
    },
    {
      path: '/walker/messages',
      label: 'Messages',
      ariaLabel: 'View messages',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
      ),
    },
    {
      path: '/walker/profile',
      label: 'Profile',
      ariaLabel: 'View profile',
      icon: (
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          role="img"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
  ];

  // Don't show bottom nav on delivery pages (they use full screen for maps)
  const hideBottomNav = location.pathname.includes('/walker/delivery/');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      <ConnectionBanner />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      {!hideBottomNav && <BottomNav items={bottomNavItems} />}
      {/* Bottom padding to prevent content from being hidden behind nav */}
      {!hideBottomNav && <div style={{ height: 'max(72px, calc(72px + env(safe-area-inset-bottom)))' }} />}
    </div>
  );
};

export default WalkerLayout;
