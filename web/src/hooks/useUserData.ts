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
  refetch: () => Promise<void>;
}

export function useUserData(): UseUserData {
  const { currentUser, loading: authLoading } = useAuthContext();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet<MeResponse>('/v1/me');
      if (r.needsRoleSelection) {
        setUserData(null);
        setNeedsRoleSelection(true);
      } else {
        setUserData(fromWire<UserData>(r.user));
        setNeedsRoleSelection(false);
      }
    } catch {
      setUserData(null);
      setNeedsRoleSelection(false);
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
      return;
    }
    void refetch();
  }, [currentUser, authLoading, refetch]);

  return { userData, needsRoleSelection, loading: authLoading || loading, refetch };
}
