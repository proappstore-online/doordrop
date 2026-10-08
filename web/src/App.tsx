import { RouterProvider, createBrowserRouter } from 'react-router-dom';
import LoginPage from './pages/auth/LoginPage';
import RoleSelectionPage from './pages/auth/RoleSelectionPage';
import ErrorPage from './pages/error/ErrorPage';
import MainLayout from './components/layout/MainLayout';
import PrivateRoute from './routes/PrivateRoute';
import ClientOnboardingGuard from './routes/ClientOnboardingGuard';
import ClientDashboard from './pages/client/ClientDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminLayout from './pages/admin/AdminLayout';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminUserDetailPage from './pages/admin/AdminUserDetailPage';
import AdminCampaignsPage from './pages/admin/AdminCampaignsPage';
import AdminCampaignDetailPage from './pages/admin/AdminCampaignDetailPage';
import AdminAddressesPage from './pages/admin/AdminAddressesPage';

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
import WalkerPublicProfile from './pages/walker/WalkerPublicProfile';

// Shared pages
import HelpPage from './pages/Help/HelpPage';
import MessagesPage from './pages/Messages/MessagesPage';
import UserProfilePage from './pages/UserProfile/UserProfilePage';
import UserProfileEditPage from './pages/UserProfile/UserProfileEditPage';
import AccountSettingsPage from './pages/UserProfile/AccountSettingsPage';
import UserPreferencesPage from './pages/UserProfile/UserPreferencesPage';
import WalkersPage from './pages/UserInfoPage/WalkersPage';
import ShareHirePage from './pages/UserInfoPage/ShareHirePage';

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
        element: <ClientOnboardingGuard />,
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
              { path: '/app/user/:userId', element: <UserProfilePage /> },
              { path: '/app/user/:userId/edit', element: <UserProfileEditPage /> },
              { path: '/app/account', element: <AccountSettingsPage /> },
              { path: '/app/preferences', element: <UserPreferencesPage /> },
              { path: '/app/messages', element: <MessagesPage /> },
              { path: '/app/messages/:campaignId', element: <MessagesPage /> },
              { path: '/app/walkers', element: <WalkersPage /> },
              { path: '/app/sharehire', element: <ShareHirePage /> },
            ],
          },
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
          { path: '/walker/user/:userId', element: <UserProfilePage /> },
          { path: '/walker/user/:userId/edit', element: <UserProfileEditPage /> },
          { path: '/walker/account', element: <AccountSettingsPage /> },
          { path: '/walker/preferences', element: <UserPreferencesPage /> },
          { path: '/walker/messages', element: <MessagesPage /> },
          { path: '/walker/messages/:campaignId', element: <MessagesPage /> },
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
          {
            element: <AdminLayout />,
            children: [
              { path: '/admin', element: <AdminDashboard /> },
              { path: '/admin/users', element: <AdminUsersPage /> },
              { path: '/admin/users/:userId', element: <AdminUserDetailPage /> },
              { path: '/admin/campaigns', element: <AdminCampaignsPage /> },
              { path: '/admin/campaigns/:campaignId', element: <AdminCampaignDetailPage /> },
              { path: '/admin/addresses', element: <AdminAddressesPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    element: <PrivateRoute />,
    children: [
      {
        element: <MainLayout />,
        children: [{ path: '/walker/:walkerId', element: <WalkerPublicProfile /> }],
      },
    ],
  },
  { path: '/help', element: <HelpPage /> },
  { path: '*', element: <ErrorPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
