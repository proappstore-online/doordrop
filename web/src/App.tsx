import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RoleSelectionPage from './pages/auth/RoleSelectionPage';
import ErrorPage from './pages/error/ErrorPage';
import MainLayout from './components/layout/MainLayout';
import PrivateRoute from './routes/PrivateRoute';
import ClientDashboard from './pages/client/ClientDashboard';
import WalkerDashboard from './pages/walker/WalkerDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

const router = createBrowserRouter([
  { path: '/', element: <LoginPage />, errorElement: <ErrorPage /> },
  { path: '/login', element: <LoginPage /> },
  {
    element: <PrivateRoute />,
    children: [
      { path: '/select-role', element: <RoleSelectionPage /> },
    ],
  },
  {
    element: <PrivateRoute allowedRoles={['client']} />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/app', element: <ClientDashboard /> },
        ],
      },
    ],
  },
  {
    element: <PrivateRoute allowedRoles={['walker']} />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/walker', element: <WalkerDashboard /> },
        ],
      },
    ],
  },
  {
    element: <PrivateRoute allowedRoles={['admin']} />,
    children: [
      {
        element: <MainLayout />,
        children: [
          { path: '/admin', element: <AdminDashboard /> },
        ],
      },
    ],
  },
  { path: '*', element: <ErrorPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
