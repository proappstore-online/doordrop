import { useUserData } from './useUserData';

export interface ClientProfileCompletionStatus {
  isComplete: boolean;
  needsOnboarding: boolean;
}

export function useClientProfileCompletion(): ClientProfileCompletionStatus {
  const { userData } = useUserData();

  const isComplete =
    userData?.role === 'client' &&
    userData?.clientProfile?.onboardingCompleted === true;

  const needsOnboarding =
    userData?.role === 'client' &&
    (!userData?.clientProfile || !userData?.clientProfile?.onboardingCompleted);

  return { isComplete, needsOnboarding };
}
