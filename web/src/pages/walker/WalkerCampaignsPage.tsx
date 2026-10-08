import React, { useEffect, useMemo, useState } from "react";
import { pushWalkerInterested } from "../../services/pushNotifications";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import type { CampaignData } from "../../models/campaign";
import type { WalkerInterest } from "../../models/walkerInterest";
import { useActiveCampaignTracking } from "../../hooks/useActiveCampaignTracking";
import LiveTrackingIndicator from "../../components/LiveTrackingIndicator";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

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

  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const activeCampaigns = useActiveCampaignTracking(campaignIds);

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
      setError("Failed to express interest. Please try again.");
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
          c.interest?.id === interestId ? { ...c, interest: undefined } : c
        )
      );
    } catch (err) {
      console.error("Failed to withdraw interest:", err);
      setError("Failed to withdraw interest. Please try again.");
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 sm:px-6">
          <div className="mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Job Discovery
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Browse available campaigns and manage your deliveries
            </p>
          </div>

          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                  activeTab === tab.id
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
                <span className="ml-2 text-xs bg-gray-200 dark:bg-gray-700 rounded-full px-2 py-0.5">
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6">
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

        {currentContent.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {activeTab === "available" &&
                "No campaigns available at the moment. Check back soon!"}
              {activeTab === "assigned" && "You haven't been assigned to any campaigns yet."}
              {activeTab === "past" && "No past campaigns yet."}
            </p>
            {activeTab === "available" && (
              <button
                onClick={loadCampaigns}
                className="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Refresh
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {currentContent.map((campaign) => {
              const isLive = activeCampaigns.has(campaign.id);
              const isInterested = campaign.interest?.status === "pending";
              const isAssigned = campaign.interest?.status === "assigned";
              const isWithdrawn = campaign.interest?.status === "withdrawn";
              const isSubmitting =
                submittingInterest === campaign.id ||
                submittingInterest === campaign.interest?.id;

              return (
                <div
                  key={campaign.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="p-4 sm:p-6">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {campaign.name}
                            </h3>
                            {isLive && <LiveTrackingIndicator size="sm" showLabel={false} />}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {campaign.suburb} {campaign.postcode}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 items-end">
                          <span
                            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                              campaignStatusColors[campaign.status] ||
                              campaignStatusColors.draft
                            }`}
                          >
                            {campaign.status}
                          </span>
                          {isInterested && (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                              Pending
                            </span>
                          )}
                          {isAssigned && (
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              Assigned
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Key stats grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-t border-b border-gray-200 dark:border-gray-700">
                        {campaign.totalDoors != null && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
                              Doors
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {campaign.totalDoors}
                            </p>
                          </div>
                        )}
                        {campaign.budget != null && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
                              Pay
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              ${campaign.budget}
                            </p>
                          </div>
                        )}
                        {campaign.dueDate && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
                              Due
                            </p>
                            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                              {new Date(campaign.dueDate).toLocaleDateString(
                                undefined,
                                { month: "short", day: "numeric" }
                              )}
                            </p>
                          </div>
                        )}
                        {campaign.activePrintoutId && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">
                              Flyer
                            </p>
                            <p className="text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                              ✓
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Link
                          to={`/walker/campaign/${campaign.id}`}
                          className="flex-1 text-center px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                        >
                          View
                        </Link>

                        {activeTab === "available" && !isAssigned && !isWithdrawn && (
                          <button
                            onClick={() =>
                              isInterested
                                ? handleWithdrawInterest(campaign.interest!.id)
                                : handleExpressInterest(campaign.id)
                            }
                            disabled={isSubmitting}
                            className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              isInterested
                                ? "border border-amber-600 dark:border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                : "bg-emerald-600 text-white hover:bg-emerald-700"
                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                          >
                            {isSubmitting
                              ? "..."
                              : isInterested
                                ? "Withdraw"
                                : "Express Interest"}
                          </button>
                        )}

                        {isAssigned && activeTab !== "assigned" && (
                          <button
                            disabled
                            className="flex-1 px-4 py-2 text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded-lg cursor-default"
                          >
                            Assigned to you
                          </button>
                        )}

                        {activeTab === "assigned" && (
                          <Link
                            to={`/walker/delivery/${campaign.id}`}
                            className="flex-1 text-center px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                          >
                            Start Delivery
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WalkerCampaignsPage;
