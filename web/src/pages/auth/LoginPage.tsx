import { useAuthContext } from '../../hooks/useAuthContext';
import { useUserData } from '../../hooks/useUserData';
import { Navigate } from 'react-router-dom';
import LoadingScreen from '../../components/LoadingScreen';

export default function LoginPage() {
  const { currentUser, loading, signIn } = useAuthContext();
  const { userData, needsRoleSelection, loading: userLoading } = useUserData();

  if (loading || (currentUser && userLoading)) return <LoadingScreen />;

  if (currentUser) {
    if (needsRoleSelection) return <Navigate to="/select-role" replace />;
    if (userData?.role === 'walker') return <Navigate to="/walker" replace />;
    if (userData?.role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-gray-100">DoorDrop</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Flyer delivery, tracked door-to-door.
        </p>
        <button
          onClick={() => signIn()}
          className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium py-3 px-4 rounded-lg hover:opacity-90 transition-opacity"
        >
          Sign in with GitHub
        </button>
      </div>
    </div>
  );
}
