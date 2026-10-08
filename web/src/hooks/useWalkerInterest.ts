import { useState } from "react";
import { WalkerInterestRepository } from "../repositories/walkerInterestRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import type { UserData } from "../models/user";
import type { WalkerInterest } from "../models/walkerInterest";
import type { CampaignData } from "../models/campaign";
import { pushWalkerAssigned } from "../services/pushNotifications";

export interface UsedWalkerInterestReturn {
  // State
  votingId: string | null;
  assigningWalkerId: string | null;
  assignmentError: string | null;

  // Handlers
  handleVote: (interestId: string) => Promise<void>;
  handleAssignWalker: (walkerId: string) => Promise<void>;
  handleUnassignWalker: () => Promise<void>;
  dismissError: () => void;
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
  const [assignmentError, setAssignmentError] = useState<string | null>(null);

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
    setAssignmentError(null);
    try {
      // Atomic transition: set status to "assigned" alongside the walker assignment
      await CampaignRepository.updateGroup(campaignId, {
        assignedWalkerId: walkerId,
        status: "assigned",
        jobStatus: "assigned",
      });
      setCampaign((prev) => prev ? { ...prev, assignedWalkerId: walkerId, status: "assigned", jobStatus: "assigned" } : prev);
      void pushWalkerAssigned(campaignId, walkerId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to assign walker:", err);
      setAssignmentError(errorMsg);
    } finally {
      setAssigningWalkerId(null);
    }
  };

  const handleUnassignWalker = async () => {
    if (!campaignId || !isAdmin) return;
    setAssigningWalkerId("unassign");
    setAssignmentError(null);
    try {
      // Atomic transition: clear walker and restore to ready/posted state
      await CampaignRepository.updateGroup(campaignId, {
        assignedWalkerId: null, // Explicitly null for field clearing
        status: "ready",
        jobStatus: "posted",
      });
      setCampaign((prev) => prev ? { ...prev, assignedWalkerId: null, status: "ready", jobStatus: "posted" } : prev);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error("Failed to unassign walker:", err);
      setAssignmentError(errorMsg);
    } finally {
      setAssigningWalkerId(null);
    }
  };

  return {
    votingId,
    assigningWalkerId,
    assignmentError,
    handleVote,
    handleAssignWalker,
    handleUnassignWalker,
    dismissError: () => setAssignmentError(null),
  };
}
