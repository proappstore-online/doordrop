import { Outlet, Link } from 'react-router-dom';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useUserData } from '../../hooks/useUserData';

export default function MainLayout() {
  const { signOut } = useAuthContext();
  const { userData } = useUserData();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/" className="font-bold text-lg">DoorDrop</Link>
          <nav className="flex items-center gap-4 text-sm">
            {userData?.role && (
              <span className="text-gray-500 dark:text-gray-400">
                {userData.name ?? userData.email} ({userData.role})
              </span>
            )}
            <button
              onClick={signOut}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              Sign out
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
