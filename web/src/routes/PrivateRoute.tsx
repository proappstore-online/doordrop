import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../hooks/useAuthContext';
import { useUserData, type Role } from '../hooks/useUserData';
import LoadingScreen from '../components/LoadingScreen';

interface Props {
  allowedRoles?: Role[];
}

export default function PrivateRoute({ allowedRoles }: Props) {
  const { currentUser, loading } = useAuthContext();
  const { userData, needsRoleSelection, loading: userLoading } = useUserData();
  const location = useLocation();

  const isLoading = loading || userLoading;
  if (isLoading) return <LoadingScreen />;

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (needsRoleSelection && location.pathname !== '/select-role') {
    return <Navigate to="/select-role" replace />;
  }

  if (!allowedRoles || !userData) return <Outlet />;

  // userData.role === 'admin' implicitly passes any allowedRoles check (admins see all routes).
  if (!allowedRoles.includes(userData.role) && userData.role !== 'admin') {
    const target = userData.role === 'walker' ? '/walker' : '/app';
    if (location.pathname !== target) return <Navigate to={target} replace />;
  }

  return <Outlet />;
}
