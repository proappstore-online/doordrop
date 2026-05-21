import { useRouteError, Link } from 'react-router-dom';

export default function ErrorPage() {
  const error = useRouteError();
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 text-center">
        <h1 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">Page not found</h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">{message}</p>
        <Link
          to="/"
          className="inline-block bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
