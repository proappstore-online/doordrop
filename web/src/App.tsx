import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RoleSelectionPage from './pages/auth/RoleSelectionPage';
import ErrorPage from './pages/error/ErrorPage';
import MainLayout from './components/layout/MainLayout';
import PrivateRoute from './routes/PrivateRoute';
import ClientDashboard from './pages/client/ClientDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';

// Client pages
import ClientCampaignDetailPage from './pages/Campaign/ClientCampaignDetailPage';
import ClientOnboardingPage from './pages/client/ClientOnboardingPage';
import CampaignSetupPage from './pages/Campaign/CampaignSetupPage';
import FlyersPage from './pages/Flyers/FlyersPage';
import PropertiesPage from './pages/Properties/PropertiesPage';
import PropertyDetailPage from './pages/Properties/PropertyDetailPage';

// Walker pages
import WalkerCampaignsPage from './pages/walker/WalkerCampaignsPage';
import WalkerCampaignDetailPage from './pages/Campaign/WalkerCampaignDetailPage';
import WalkerDeliveryPage from './pages/walker/WalkerDeliveryPage';
import WalkerDeliverRedirect from './pages/walker/WalkerDeliverRedirect';
import WalkerDashboardPage from './pages/walker/WalkerDashboardPage';
import WalkerHistoryPage from './pages/walker/WalkerHistoryPage';
import WalkerSetupPage from './pages/walker/WalkerSetupPage';
import DoorDetailPage from './pages/Campaign/DoorDetailPage';

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
          { path: '/app/onboarding', element: <ClientOnboardingPage /> },
          { path: '/app/setup', element: <CampaignSetupPage /> },
          { path: '/app/campaign/:campaignId', element: <ClientCampaignDetailPage /> },
          { path: '/app/campaign/:campaignId/door/:doorId', element: <DoorDetailPage /> },
          { path: '/app/flyers', element: <FlyersPage /> },
          { path: '/app/properties', element: <PropertiesPage /> },
          { path: '/app/properties/:propertyId', element: <PropertyDetailPage /> },
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
          { path: '/walker', element: <WalkerCampaignsPage /> },
          { path: '/walker/dashboard', element: <WalkerDashboardPage /> },
          { path: '/walker/setup', element: <WalkerSetupPage /> },
          { path: '/walker/history', element: <WalkerHistoryPage /> },
          { path: '/walker/streets', element: <WalkerCampaignsPage /> },
          { path: '/walker/deliver', element: <WalkerDeliverRedirect /> },
          { path: '/walker/campaign/:campaignId', element: <WalkerCampaignDetailPage /> },
          { path: '/walker/campaign/:campaignId/deliver', element: <WalkerDeliveryPage /> },
          { path: '/walker/campaign/:campaignId/door/:doorId', element: <DoorDetailPage /> },
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
