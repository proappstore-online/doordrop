import { useProAuth } from '@proappstore/sdk/hooks';
import type { AuthProvider } from '@proappstore/sdk';
import { pas } from '../services/pas';

// Compat wrapper preserving the original DoorDrop hook surface
// (`currentUser`, `loading`) over the PAS SDK's `useProAuth`.
export function useAuthContext() {
  const { user, loading, signOut, deleteAccount } = useProAuth(pas);
  // The SDK hook's signIn() takes no args; call auth.signIn(provider) directly.
  const signIn = (provider?: AuthProvider) => pas.auth.signIn(provider);
  return {
    logout: signOut,
    currentUser: user,
    loading,
    signIn,
    signOut,
    deleteAccount,
  };
}

// Original DoorDrop also exposed `useAuth` as an alias on the same hook;
// preserve it so ported pages don't need import-name surgery.
export const useAuth = useAuthContext;

export type { User } from '@proappstore/sdk';
