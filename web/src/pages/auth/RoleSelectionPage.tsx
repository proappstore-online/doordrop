import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiPost } from '../../lib/api';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useUserData } from '../../hooks/useUserData';

export default function RoleSelectionPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthContext();
  const { refetch } = useUserData();
  const [submitting, setSubmitting] = useState(false);

  const choose = async (role: 'client' | 'walker') => {
    if (!currentUser) return;
    setSubmitting(true);
    try {
      await apiPost('/v1/me/role', {
        role,
        name: currentUser.login,
        photoUrl: currentUser.avatarUrl ?? undefined,
      });
      await refetch();
      navigate(role === 'walker' ? '/walker' : '/app', { replace: true });
    } catch (e) {
      toast.error(`Failed to set role: ${e instanceof Error ? e.message : String(e)}`);
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            disabled={submitting}
            onClick={() => choose('client')}
            className="text-left bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            <h2 className="text-xl font-semibold mb-2">I'm a client</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Hire walkers to deliver flyers in your target suburbs.
            </p>
          </button>
          <button
            disabled={submitting}
            onClick={() => choose('walker')}
            className="text-left bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow disabled:opacity-50"
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
