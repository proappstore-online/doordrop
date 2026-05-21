import { useState } from "react";
import { WalkerInterestRepository } from "../repositories/walkerInterestRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import type { UserData } from "../models/user";
import type { WalkerInterest } from "../models/walkerInterest";
import type { CampaignData } from "../models/campaign";

export interface UsedWalkerInterestReturn {
  // State
  votingId: string | null;
  assigningWalkerId: string | null;

  // Handlers
  handleVote: (interestId: string) => Promise<void>;
  handleAssignWalker: (walkerId: string) => Promise<void>;
  handleUnassignWalker: () => Promise<void>;
}

export function useWalkerInterest(
  campaignId: string | undefined,
  currentUserId: string | undefined,
  isAdmin: boolean,
  setInterestedWalkers: React.Dispatch<React.SetStateAction<{
    interest: WalkerInterest & { id: string };
    walker: UserData & { id: string };
    voteCount: number;
    userVoted: boolean;
  }[]>>,
  setCampaign: React.Dispatch<React.SetStateAction<(CampaignData & { id: string }) | null>>
): UsedWalkerInterestReturn {
  const [votingId, setVotingId] = useState<string | null>(null);
  const [assigningWalkerId, setAssigningWalkerId] = useState<string | null>(null);

  const handleVote = async (interestId: string) => {
    if (!currentUserId) return;
    setVotingId(interestId);
    try {
      await WalkerInterestRepository.castVote(interestId, currentUserId);
      setInterestedWalkers((prev) =>
        prev.map((item) =>
          item.interest.id === interestId
            ? { ...item, userVoted: true, voteCount: item.voteCount + 1 }
            : item
        )
      );
    } catch (err) {
      console.error("Failed to cast vote:", err);
    } finally {
      setVotingId(null);
    }
  };

  const handleAssignWalker = async (walkerId: string) => {
    if (!campaignId || !isAdmin) return;
    setAssigningWalkerId(walkerId);
    try {
      await CampaignRepository.updateGroup(campaignId, {
        assignedWalkerId: walkerId,
        jobStatus: "assigned",
      });
      setCampaign((prev) => prev ? { ...prev, assignedWalkerId: walkerId, jobStatus: "assigned" } : prev);
    } catch (err) {
      console.error("Failed to assign walker:", err);
    } finally {
      setAssigningWalkerId(null);
    }
  };

  const handleUnassignWalker = async () => {
    if (!campaignId || !isAdmin) return;
    setAssigningWalkerId("unassign");
    try {
      await CampaignRepository.updateGroup(campaignId, {
        assignedWalkerId: undefined,
        jobStatus: "posted",
      } as any);
      setCampaign((prev) => prev ? { ...prev, assignedWalkerId: undefined, jobStatus: "posted" } : prev);
    } catch (err) {
      console.error("Failed to unassign walker:", err);
    } finally {
      setAssigningWalkerId(null);
    }
  };

  return {
    votingId,
    assigningWalkerId,
    handleVote,
    handleAssignWalker,
    handleUnassignWalker,
  };
}
