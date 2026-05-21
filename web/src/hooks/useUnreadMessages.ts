import { useState, useEffect } from 'react';
import { useAuthContext } from './useAuthContext';
import { useUserData } from './useUserData';
import { ChatRepository } from '../repositories/chatRepository';
import { CampaignRepository } from '../repositories/campaignRepository';
import type { CampaignData } from '../models/campaign';
import type { ChatReadState } from '../models/chatReadState';

type CampaignWithId = CampaignData & { id: string };

const CAMPAIGNS_POLL_MS = 10_000;

export function useUnreadMessages() {
  const { currentUser } = useAuthContext();
  const { userData } = useUserData();
  const [totalUnread, setTotalUnread] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [readStates, setReadStates] = useState<Record<string, ChatReadState>>({});

  // Polling: fetch the user's campaigns periodically (admin or walker side).
  useEffect(() => {
    if (!currentUser || !userData?.role) return;
    let cancelled = false;

    const fetchCampaigns = async () => {
      try {
        const list =
          userData.role === 'walker'
            ? await CampaignRepository.getCampaignsByAssignedWalker(currentUser.id)
            : await CampaignRepository.getCampaignsByUser(currentUser.id);
        if (!cancelled) setCampaigns(list);
      } catch {
        /* swallow */
      }
    };

    void fetchCampaigns();
    const interval = setInterval(() => void fetchCampaigns(), CAMPAIGNS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentUser, userData?.role]);

  // Read-state subscription (already polling internally; see chatRepository).
  useEffect(() => {
    if (!currentUser) return;
    return ChatRepository.subscribeToReadStates(currentUser.id, setReadStates);
  }, [currentUser]);

  // Compute unread by fetching each campaign's latest note and comparing.
  useEffect(() => {
    if (campaigns.length === 0) {
      setTotalUnread(0);
      return;
    }
    let cancelled = false;

    const compute = async () => {
      let count = 0;
      await Promise.all(
        campaigns.map(async (c) => {
          const latest = await ChatRepository.getLatestMessage(c.id);
          if (!latest) return;
          const readState = readStates[c.id];
          if (!readState || latest.createdAt > readState.lastReadAt) count++;
        }),
      );
      if (!cancelled) setTotalUnread(count);
    };

    void compute();
    return () => {
      cancelled = true;
    };
  }, [campaigns, readStates]);

  return { totalUnread };
}
