import type { Location } from 'react-router-dom';
import type { UserData } from '../hooks/useUserData';

/**
 * Validates that a path is same-origin (local) and not a protocol-relative URL.
 * Prevents open redirects to external sites.
 */
export function isSameOriginPath(path: string): boolean {
  if (typeof path !== 'string') return false;
  // Must start with / and not be a protocol-relative URL (starts with //)
  return path.startsWith('/') && !path.startsWith('//');
}

/**
 * Returns the role-appropriate home route for a user.
 */
export function getRoleHomeForUser(userData: UserData | null | undefined): string {
  if (!userData) return '/app';
  if (userData.role === 'walker') return '/walker';
  if (userData.role === 'admin') return '/admin';
  return '/app';
}

/**
 * Checks if a given route path is compatible with the user's role.
 */
export function isRouteCompatibleWithRole(path: string, role: string | null | undefined): boolean {
  if (!path.startsWith('/')) return false;

  // Extract the first segment of the path (e.g., 'app' from '/app/campaign/123')
  const segments = path.split('/').filter(Boolean);
  const firstSegment = segments[0];

  // Routes that are always accessible
  if (firstSegment === 'select-role' || firstSegment === 'help') return true;

  // Role-specific route validation
  if (firstSegment === 'app') return role === 'client' || role === 'admin';
  if (firstSegment === 'walker') {
    // /walker/:userId is a public profile, accessible to anyone authenticated
    if (segments.length === 2 && segments[0] === 'walker') return true;
    // Other /walker/* routes are only for walkers and admins
    return role === 'walker' || role === 'admin';
  }
  if (firstSegment === 'admin') return role === 'admin';

  return false;
}

interface ResolveReturnTargetResult {
  path: string;
  wasRedirected: boolean;
  reason?: 'unsafe' | 'role' | 'missing';
}

/**
 * Resolves the return target after sign-in, validating the deep link against the user's role.
 * Falls back to role home if the target is unsafe, incompatible, or missing.
 */
export function resolveReturnTarget(
  from: Location | string | null | undefined,
  userData: UserData | null | undefined,
): ResolveReturnTargetResult {
  const roleHome = getRoleHomeForUser(userData);
  const role = userData?.role;

  // If no 'from' state, just go to role home
  if (!from) {
    return { path: roleHome, wasRedirected: false, reason: 'missing' };
  }

  // Extract path from Location object or use string directly
  let targetPath: string;
  if (typeof from === 'string') {
    targetPath = from;
  } else if (from && typeof from === 'object' && 'pathname' in from) {
    // It's a Location object; reconstruct the full URL with search and hash
    targetPath = from.pathname + (from.search || '') + (from.hash || '');
  } else {
    return { path: roleHome, wasRedirected: false, reason: 'missing' };
  }

  // Validate same-origin (prevent open redirects)
  if (!isSameOriginPath(targetPath)) {
    return { path: roleHome, wasRedirected: true, reason: 'unsafe' };
  }

  // Validate role compatibility
  if (!isRouteCompatibleWithRole(targetPath, role)) {
    return { path: roleHome, wasRedirected: true, reason: 'role' };
  }

  // Return the original target path
  return { path: targetPath, wasRedirected: false };
}
