import React from 'react';
import { NavLink } from 'react-router-dom';

export interface BottomNavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

interface BottomNavProps {
  items: BottomNavItem[];
}

const BottomNav: React.FC<BottomNavProps> = ({ items }) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-40"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <div className="flex justify-around items-stretch">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center h-16 transition-colors relative ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
              }`
            }
            aria-label={item.ariaLabel}
          >
            {({ isActive }) => (
              <>
                <div className="flex items-center justify-center h-6 w-6 mb-1">
                  {item.icon}
                </div>
                <span className="text-xs font-medium truncate px-1">{item.label}</span>
                {isActive && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"
                    aria-hidden="true"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
