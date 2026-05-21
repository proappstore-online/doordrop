import { useState, useEffect } from 'react';
import { CampaignRepository } from '../repositories/campaignRepository';
import { DoorRepository } from '../repositories/doorRepository';
import { PrintoutRepository } from '../repositories/printoutRepository';
import { WalkerInterestRepository } from '../repositories/walkerInterestRepository';
import { WalkerReviewRepository } from '../repositories/walkerReviewRepository';
import { UserRepository } from '../repositories/userRepository';
import type { CampaignData } from '../models/campaign';
import type { DoorData } from '../models/door';
import type { PrintoutData } from '../models/printout';
import type { UserData } from '../models/user';
import type { WalkerInterest } from '../models/walkerInterest';

const DOORS_POLL_MS = 5000;

export interface UseCampaignDataReturn {
  campaign: (CampaignData & { id: string }) | null;
  doors: (DoorData & { id: string })[];
  printouts: (PrintoutData & { id: string })[];
  interestedWalkers: {
    interest: WalkerInterest & { id: string };
    walker: UserData & { id: string };
    voteCount: number;
    userVoted: boolean;
  }[];
  loading: boolean;
  hasReviewed: boolean;
  reviewCheckDone: boolean;
  assignedWalkerName: string;
  setCampaign: React.Dispatch<React.SetStateAction<(CampaignData & { id: string }) | null>>;
  setDoors: React.Dispatch<React.SetStateAction<(DoorData & { id: string })[]>>;
  setPrintouts: React.Dispatch<React.SetStateAction<(PrintoutData & { id: string })[]>>;
  setInterestedWalkers: React.Dispatch<React.SetStateAction<{
    interest: WalkerInterest & { id: string };
    walker: UserData & { id: string };
    voteCount: number;
    userVoted: boolean;
  }[]>>;
  setHasReviewed: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useCampaignData(campaignId: string | undefined, currentUserId: string | undefined) {
  const [campaign, setCampaign] = useState<(CampaignData & { id: string }) | null>(null);
  const [doors, setDoors] = useState<(DoorData & { id: string })[]>([]);
  const [printouts, setPrintouts] = useState<(PrintoutData & { id: string })[]>([]);
  const [interestedWalkers, setInterestedWalkers] = useState<
    {
      interest: WalkerInterest & { id: string };
      walker: UserData & { id: string };
      voteCount: number;
      userVoted: boolean;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [hasReviewed, setHasReviewed] = useState(false);
  const [reviewCheckDone, setReviewCheckDone] = useState(false);
  const [assignedWalkerName, setAssignedWalkerName] = useState<string>('');

  useEffect(() => {
    if (!campaignId || !currentUserId) return;

    const load = async () => {
      setLoading(true);
      try {
        const [campaignData, printoutsData] = await Promise.all([
          CampaignRepository.getGroup(campaignId),
          PrintoutRepository.getVersions(campaignId),
        ]);

        setCampaign(campaignData);
        setPrintouts(printoutsData);

        if (campaignData?.adminIds?.includes(currentUserId)) {
          const interests = await WalkerInterestRepository.getInterestsByCampaign(campaignId);
          const enriched = await Promise.all(
            interests.map(async (interest) => {
              const walker = await UserRepository.getUser(interest.walkerId);
              if (!walker) return null;
              const [voteCount, userVoted] = await Promise.all([
                WalkerInterestRepository.getVoteCount(interest.id),
                WalkerInterestRepository.hasUserVoted(interest.id, currentUserId),
              ]);
              return { interest, walker: { ...walker, id: interest.walkerId }, voteCount, userVoted };
            }),
          );
          setInterestedWalkers(enriched.filter(Boolean) as typeof interestedWalkers);
        }

        if (
          (campaignData?.status === 'complete' || campaignData?.status === 'review') &&
          campaignData.assignedWalkerId &&
          campaignData.adminIds?.includes(currentUserId)
        ) {
          const existingReview = await WalkerReviewRepository.getReviewByScheduleAndReviewer(
            campaignData.assignedWalkerId,
            campaignId,
            currentUserId,
          );
          setHasReviewed(!!existingReview);

          const walkerDoc = await UserRepository.getUser(campaignData.assignedWalkerId);
          if (walkerDoc) {
            setAssignedWalkerName(
              walkerDoc.walkerProfile?.firstName
                ? `${walkerDoc.walkerProfile.firstName} ${walkerDoc.walkerProfile.lastName || ''}`.trim()
                : walkerDoc.name,
            );
          }
        }
        setReviewCheckDone(true);
      } catch (err) {
        console.error('Failed to load campaign:', err);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [campaignId, currentUserId]);

  // Live-ish doors (polling — port to fas.rooms `doors:{campaignId}` later).
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;

    const fetchDoors = async () => {
      try {
        const updated = await DoorRepository.getDoorsByCampaign(campaignId);
        if (!cancelled) setDoors(updated);
      } catch {
        /* swallow — next tick retries */
      }
    };

    void fetchDoors();
    const interval = setInterval(() => void fetchDoors(), DOORS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  return {
    campaign,
    doors,
    printouts,
    interestedWalkers,
    loading,
    hasReviewed,
    reviewCheckDone,
    assignedWalkerName,
    setCampaign,
    setDoors,
    setPrintouts,
    setInterestedWalkers,
    setHasReviewed,
  };
}
