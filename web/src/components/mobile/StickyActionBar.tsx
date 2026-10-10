import React from 'react';

interface ActionBarButton {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
}

interface StickyActionBarProps {
  actions: ActionBarButton[];
  className?: string;
}

const StickyActionBar: React.FC<StickyActionBarProps> = ({ actions, className }) => {
  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-lg z-30 ${className || ''}`}
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0px)' }}
      role="region"
      aria-label="Action bar"
    >
      <div className="px-4 py-3 sm:px-6">
        <div className="flex gap-3">
          {actions.map((action, idx) => {
            const baseClasses =
              'flex-1 h-12 px-4 rounded-lg font-medium transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed min-w-0';
            const variantClasses =
              action.variant === 'danger'
                ? 'bg-red-600 dark:bg-red-700 text-white hover:bg-red-700 dark:hover:bg-red-600'
                : action.variant === 'secondary'
                  ? 'border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                  : 'bg-emerald-600 dark:bg-emerald-700 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600';

            return (
              <button
                key={idx}
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
                aria-label={action.ariaLabel || action.label}
                className={`${baseClasses} ${variantClasses}`}
              >
                {action.loading ? (
                  <svg
                    className="w-5 h-5 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    role="img"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <span className="truncate">{action.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StickyActionBar;
