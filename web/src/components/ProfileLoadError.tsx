import { useCallback } from 'react';
import { useAuthContext } from '../hooks/useAuthContext';

interface Props {
  error: Error;
  onRetry: () => Promise<void>;
}

export default function ProfileLoadError({ error, onRetry }: Props) {
  const { signOut } = useAuthContext();
  const isTimeout = error.message.includes('timeout') || error.message.includes('Timeout');

  const handleRetry = useCallback(async () => {
    await onRetry();
  }, [onRetry]);

  const handleSignOut = useCallback(() => {
    void signOut();
  }, [signOut]);

  return (
    <div className="flex justify-center items-center h-screen bg-gray-50 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900 mb-4">
            <svg
              className="w-6 h-6 text-red-600 dark:text-red-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Could Not Load Profile
          </h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {isTimeout
              ? 'The connection took too long. Please check your internet and try again.'
              : 'An error occurred while loading your profile. Please try again.'}
          </p>

          <p className="text-sm text-gray-500 dark:text-gray-500 mb-6 break-words">
            {error.message}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
            >
              Try Again
            </button>

            <button
              onClick={handleSignOut}
              className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white font-medium rounded-lg transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
