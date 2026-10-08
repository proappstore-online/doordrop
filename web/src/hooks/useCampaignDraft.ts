import { useState, useCallback, useEffect } from "react";
import type { CampaignData } from "../models/campaign";

interface DraftData {
  currentStep: number;
  campaignId?: string;
  data: Partial<CampaignData>;
  timestamp: number;
}

const STORAGE_KEY_PREFIX = "campaign_draft_";

export const useCampaignDraft = (userId?: string) => {
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    if (!userId) {
      setIsLoaded(true);
      return;
    }

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored) as DraftData;
        // Only restore if draft is less than 7 days old
        if (Date.now() - parsed.timestamp < 7 * 24 * 60 * 60 * 1000) {
          setDraft(parsed);
        } else {
          localStorage.removeItem(storageKey);
        }
      }
    } catch (err) {
      console.warn("Failed to load draft from localStorage:", err);
    } finally {
      setIsLoaded(true);
    }
  }, [userId]);

  // Save draft to localStorage
  const saveDraft = useCallback(
    (currentStep: number, data: Partial<CampaignData>, campaignId?: string) => {
      if (!userId) return;

      try {
        const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
        const draftData: DraftData = {
          currentStep,
          campaignId,
          data,
          timestamp: Date.now(),
        };
        localStorage.setItem(storageKey, JSON.stringify(draftData));
        setDraft(draftData);
      } catch (err) {
        console.warn("Failed to save draft to localStorage:", err);
      }
    },
    [userId]
  );

  // Clear draft from localStorage
  const clearDraft = useCallback(() => {
    if (!userId) return;

    try {
      const storageKey = `${STORAGE_KEY_PREFIX}${userId}`;
      localStorage.removeItem(storageKey);
      setDraft(null);
    } catch (err) {
      console.warn("Failed to clear draft from localStorage:", err);
    }
  }, [userId]);

  return {
    draft,
    isLoaded,
    saveDraft,
    clearDraft,
  };
};
