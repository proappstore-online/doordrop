import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuthContext';
import { useUserData, type Role } from '../hooks/useUserData';
import LoadingScreen from '../components/LoadingScreen';
import ProfileLoadError from '../components/ProfileLoadError';

interface Props {
  allowedRoles?: Role[];
}

export default function PrivateRoute({ allowedRoles }: Props) {
  const { currentUser, loading } = useAuthContext();
  const { userData, needsRoleSelection, loading: userLoading, error, refetch } = useUserData();
  const location = useLocation();

  const isLoading = loading || userLoading;
  if (isLoading) return <LoadingScreen />;

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (needsRoleSelection && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  // Enrolled users should not be on the role selection page; redirect to their home
  if (!needsRoleSelection && location.pathname === '/select-role' && userData) {
    const target = userData.role === 'walker' ? '/walker' : userData.role === 'admin' ? '/admin' : '/app';
    return <Navigate to={target} replace />;
  }

  // If profile failed to load, show error screen with retry/sign-out options
  if (error) {
    return <ProfileLoadError error={error} onRetry={refetch} />;
  }

  // Fail-closed: role-gated routes stay blocked until userData loads successfully
  // Unprotected routes (no allowedRoles) wait for userData to load before rendering
  if (!userData) {
    return <LoadingScreen />;
  }

  // userData exists: check role constraints
  if (allowedRoles) {
    // userData.role === 'admin' implicitly passes any allowedRoles check (admins see all routes).
    if (!allowedRoles.includes(userData.role) && userData.role !== 'admin') {
      const target = userData.role === 'walker' ? '/walker' : '/app';
      if (location.pathname !== target) return <Navigate to={target} replace />;
    }
  }

  return <Outlet />;
}
