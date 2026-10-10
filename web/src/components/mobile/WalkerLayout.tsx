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
      label: 'Campaigns',
      ariaLabel: 'Browse campaigns and assigned work',
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
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
    },
    {
      path: '/walker/history',
      label: 'History',
      ariaLabel: 'View past deliveries and earnings',
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
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
    },
    {
      path: '/walker/messages',
      label: 'Messages',
      ariaLabel: 'View messages from campaign admins',
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
      ariaLabel: 'View your profile and settings',
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
