import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from './useAuthContext';
import { apiGet } from '../lib/api';
import { fromWire } from '../lib/transform';
import type { UserData as UserModel } from '../models/user';

export type Role = 'client' | 'walker' | 'admin';

// Use the canonical UserData from models, plus the id from the row.
export type UserData = UserModel & { id: string; role: Role };

interface MeResponse {
  user: Record<string, unknown>;
  needsRoleSelection: boolean;
}

export interface UseUserData {
  userData: UserData | null;
  needsRoleSelection: boolean;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// Many components call this hook at once; share one in-flight /v1/me between them
// (identical concurrent GETs also queue behind each other in the browser).
let inflight: Promise<MeResponse> | null = null;
function fetchMe(): Promise<MeResponse> {
  inflight ??= apiGet<MeResponse>('/v1/me').finally(() => { inflight = null; });
  return inflight;
}

export function useUserData(): UseUserData {
  const { currentUser, loading: authLoading } = useAuthContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const r = await fetchMe();
      if (r.needsRoleSelection) {
        setUserData(null);
        setNeedsRoleSelection(true);
        setError(null);
      } else {
        setUserData(fromWire<UserData>(r.user));
        setNeedsRoleSelection(false);
        setError(null);
      }
    } catch (err) {
      setUserData(null);
      setNeedsRoleSelection(false);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!currentUser) {
      setUserData(null);
      setNeedsRoleSelection(false);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    void refetch();
    // Keyed on the id: useProAuth hands out a new user object on every auth refresh.
  }, [currentUser?.id, authLoading, refetch]);

  return { userData, needsRoleSelection, loading: authLoading || loading, error, refetch };
}
