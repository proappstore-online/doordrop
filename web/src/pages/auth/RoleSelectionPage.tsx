import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost } from '../../lib/api';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useUserData } from '../../hooks/useUserData';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthContext();
  const { needsRoleSelection, refetch } = useUserData();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If the user doesn't need role selection (already has one), redirect them
  // This shouldn't happen in normal flow due to PrivateRoute guard, but defensive check
  if (needsRoleSelection === false) {
    // User is enrolled; PrivateRoute should have redirected them, but redirect here as fallback
    setTimeout(() => navigate('/app', { replace: true }), 0);
    return null;
  }

  const choose = async (role: 'client' | 'walker') => {
    if (!currentUser || !needsRoleSelection) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiPost('/v1/me/role', {
        role,
        name: currentUser.login,
        photoUrl: currentUser.avatarUrl ?? undefined,
      });
      await refetch();
      navigate(role === 'walker' ? '/walker' : '/app', { replace: true });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-2xl w-full">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">
          Welcome to DoorDrop
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Are you here to hire a walker, or to deliver?
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <svg
                  className="h-5 w-5 text-red-600 dark:text-red-200"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Failed to set role: {error}
                </p>
                <button
                  onClick={() => setError(null)}
                  className="mt-2 text-sm text-red-600 dark:text-red-300 hover:underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            disabled={submitting || !needsRoleSelection}
            onClick={() => choose('client')}
            className="text-left bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <h2 className="text-xl font-semibold mb-2">I'm a client</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hire walkers to deliver flyers in your target suburbs.
            </p>
          </button>
          <button
            disabled={submitting || !needsRoleSelection}
            onClick={() => choose('walker')}
            className="text-left bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <h2 className="text-xl font-semibold mb-2">I'm a walker</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Earn by delivering flyers door-to-door, GPS-tracked.
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}
