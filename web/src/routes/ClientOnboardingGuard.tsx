import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useClientProfileCompletion } from '../hooks/useClientProfileCompletion';
import { useUserData } from '../hooks/useUserData';
import LoadingScreen from '../components/LoadingScreen';

/**
 * Guard for client routes: redirects incomplete clients to onboarding before allowing access
 * to campaign creation, dashboard, etc. The onboarding page itself is not protected by this guard.
 */
export default function ClientOnboardingGuard() {
  const location = useLocation();
  const { loading, error } = useUserData();
  const { needsOnboarding } = useClientProfileCompletion();

  // Paths where onboarding redirect is not enforced (these pages can be visited during onboarding)
  const onboardingExemptPaths = [
    '/app/onboarding',
    '/app/user',
    '/app/account',
    '/app/preferences',
  ];

  const isExempt = onboardingExemptPaths.some((path) =>
    location.pathname.startsWith(path),
  );

  // Still loading user data
  if (loading || error) {
    return <LoadingScreen />;
  }

  // If client needs onboarding and is NOT on an exempt path, redirect to onboarding
  if (needsOnboarding && !isExempt) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <Outlet />;
}
