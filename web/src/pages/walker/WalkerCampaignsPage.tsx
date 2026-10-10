import React, { useEffect, useMemo, useState } from "react";
import { pushWalkerInterested } from "../../services/pushNotifications";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import type { CampaignData } from "../../models/campaign";
import type { WalkerInterest } from "../../models/walkerInterest";
import MobilePageHeader from "../../components/mobile/MobilePageHeader";
import CampaignCard from "../../components/mobile/CampaignCard";

type Tab = "available" | "assigned" | "past";

interface CampaignWithInterest extends CampaignData {
  id: string;
  interest?: WalkerInterest & { id: string };
}

const WalkerCampaignsPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const [activeTab, setActiveTab] = useState<Tab>("available");
  const [campaigns, setCampaigns] = useState<CampaignWithInterest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submittingInterest, setSubmittingInterest] = useState<string | null>(null);


  const loadCampaigns = async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const [active, assigned, interests] = await Promise.all([
        CampaignRepository.getActiveCampaigns(),
        CampaignRepository.getCampaignsByAssignedWalker(currentUser.id),
        WalkerInterestRepository.getInterestsByWalker(currentUser.id),
      ]);

      const interestMap = new Map(interests.map((i) => [i.campaignId, i]));
      const seen = new Set<string>();
      const merged: CampaignWithInterest[] = [];

      for (const c of [...assigned, ...active]) {
        if (!seen.has(c.id)) {
          seen.add(c.id);
          merged.push({
            ...c,
            interest: interestMap.get(c.id),
          });
        }
      }

      setCampaigns(merged);
    } catch (err) {
      console.error("Failed to load campaigns:", err);
      setError("Failed to load campaigns. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, [currentUser]);

  const handleExpressInterest = async (campaignId: string) => {
    if (!currentUser) return;
    setSubmittingInterest(campaignId);
    try {
      const interestId = await WalkerInterestRepository.createInterest({
        walkerId: currentUser.id,
        campaignId,
        status: "pending",
        createdAt: new Date(),
      });
      setCampaigns((prev) =>
        prev.map((c) =>
          c.id === campaignId
            ? {
                ...c,
                interest: {
                  id: interestId,
                  walkerId: currentUser.id,
                  campaignId,
                  status: "pending",
                  createdAt: new Date(),
                },
              }
            : c
        )
      );
      const campaign = campaigns.find((c) => c.id === campaignId);
      if (campaign) {
        void pushWalkerInterested(campaign, currentUser.id, currentUser.login || "A walker");
      }
    } catch (err) {
      console.error("Failed to express interest:", err);
      // Preserve the intent: only clear submitting state, don't clear the campaign from UI
      setError("Failed to express interest. Please try again.");
      // Re-check the actual state from server to avoid false state
      void loadCampaigns();
    } finally {
      setSubmittingInterest(null);
    }
  };

  const handleWithdrawInterest = async (interestId: string) => {
    setSubmittingInterest(interestId);
    try {
      await WalkerInterestRepository.withdrawInterest(interestId);
      setCampaigns((prev) =>
        prev.map((c) =>
          c.interest?.id === interestId
            ? {
                ...c,
                interest: {
                  ...c.interest,
                  status: "withdrawn",
                }
              }
            : c
        )
      );
    } catch (err) {
      console.error("Failed to withdraw interest:", err);
      // Preserve the intent: only clear submitting state
      setError("Failed to withdraw interest. Please try again.");
      // Re-check the actual state from server to avoid false state
      void loadCampaigns();
    } finally {
      setSubmittingInterest(null);
    }
  };

  const { available, assigned, past } = useMemo(() => {
    const av: CampaignWithInterest[] = [];
    const as: CampaignWithInterest[] = [];
    const p: CampaignWithInterest[] = [];

    campaigns.forEach((c) => {
      if (c.assignedWalkerId === currentUser?.id) {
        as.push(c);
      } else if (["complete", "review", "payment", "archive"].includes(c.status)) {
        p.push(c);
      } else if (c.status === "ready" || c.status === "assigned") {
        av.push(c);
      }
    });

    av.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    as.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    p.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { available: av, assigned: as, past: p };
  }, [campaigns, currentUser]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "available", label: "Available", count: available.length },
    { id: "assigned", label: "My Campaigns", count: assigned.length },
    { id: "past", label: "Past", count: past.length },
  ];

  const tabContent = {
    available,
    assigned,
    past,
  };

  const currentContent = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      <MobilePageHeader
        title="Job Discovery"
        subtitle="Find work that matches your availability"
        showBackButton={false}
      />

      <div
        className="sticky top-[73px] z-10 bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="Campaign tabs"
      >
        <div className="flex gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-label={`${tab.label} campaigns (${tab.count})`}
              className={`px-3 py-3 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap min-h-[44px] flex items-center gap-2 ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-600"
                  : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
              <span className="text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-6 sm:px-6" role="tabpanel" aria-live="polite">
        {error && (
          <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
              <button
                onClick={loadCampaigns}
                className="text-sm font-medium text-red-600 dark:text-red-400 hover:underline"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-600 dark:text-gray-400">Loading campaigns...</p>
            </div>
          </div>
        ) : currentContent.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="mb-4 text-4xl">
              {activeTab === "available" && "📋"}
              {activeTab === "assigned" && "✓"}
              {activeTab === "past" && "📜"}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-sm">
              {activeTab === "available" &&
                "No campaigns available at the moment. Check back soon!"}
              {activeTab === "assigned" && "You haven't been assigned to any campaigns yet."}
              {activeTab === "past" && "No past campaigns yet."}
            </p>
            {activeTab === "available" && (
              <button
                onClick={loadCampaigns}
                className="inline-block h-11 px-6 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                aria-label="Refresh available campaigns"
              >
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {currentContent.map((campaign) => {
              const isInterested = campaign.interest?.status === "pending";
              const isAssigned = campaign.interest?.status === "assigned";
              const isSubmitting =
                submittingInterest === campaign.id ||
                submittingInterest === campaign.interest?.id;

              return (
                <CampaignCard
                  key={campaign.id}
                  campaign={campaign}
                  isInterested={isInterested && activeTab === "available"}
                  isAssigned={isAssigned}
                  onExpressInterest={() => handleExpressInterest(campaign.id)}
                  onWithdrawInterest={() => handleWithdrawInterest(campaign.interest!.id)}
                  isLoading={isSubmitting}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalkerCampaignsPage;
