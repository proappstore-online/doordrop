import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { UserRepository } from "../../repositories/userRepository";
import type { CampaignData } from "../../models/campaign";
import { useActiveCampaignTracking } from "../../hooks/useActiveCampaignTracking";
import LiveTrackingIndicator from "../../components/LiveTrackingIndicator";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

type FilterTab = "all" | "active" | "completed" | "archived";

const DashboardPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<(CampaignData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterTab>("all");

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      try {
        // Check if client has completed onboarding
        const user = await UserRepository.getUser(currentUser.id);
        if (user?.role === "client" && !user.clientProfile?.onboardingCompleted) {
          navigate("/app/onboarding", { replace: true });
          return;
        }
        const data = await CampaignRepository.getCampaignsByUser(currentUser.id);
        setCampaigns(data);
      } catch (err) {
        console.error("Error fetching campaigns:", err);
        setErrorMsg("Failed to load campaigns.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  // Track which campaigns have active walker tracking
  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const activeCampaigns = useActiveCampaignTracking(campaignIds);

  const filteredCampaigns = campaigns.filter((c) => {
    if (filter === "all") return true;
    if (filter === "active") return c.status === "draft" || c.status === "ready" || c.status === "assigned";
    if (filter === "completed") return c.status === "complete" || c.status === "review" || c.status === "payment";
    if (filter === "archived") return c.status === "archive";
    return true;
  });

  if (loading) {
    return (
      <div className="text-center mt-8">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <p className="text-red-600 dark:text-red-400 text-center">{errorMsg}</p>
      </div>
    );
  }

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "completed", label: "Completed" },
    { key: "archived", label: "Archived" },
  ];

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          My Campaigns
        </h1>
        <Link
          to="/app/setup"
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors no-underline"
        >
          + New Campaign
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              filter === tab.key
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Campaign grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {campaigns.length === 0
              ? "You don't have any campaigns yet."
              : "No campaigns match this filter."}
          </p>
          {campaigns.length === 0 && (
            <Link
              to="/app/setup"
              className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors no-underline"
            >
              Create Your First Campaign
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`/app/campaign/${campaign.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow no-underline"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {campaign.name}
                  </h3>
                  {activeCampaigns.has(campaign.id) && <LiveTrackingIndicator size="md" showLabel />}
                </div>
                {campaign.status && (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${campaignStatusColors[campaign.status] || campaignStatusColors.draft}`}>
                    {campaign.status}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                {campaign.suburb} {campaign.postcode}
              </p>
              <div className="grid grid-cols-3 gap-2 text-sm">
                {campaign.totalDoors != null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Doors</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{campaign.totalDoors}</p>
                  </div>
                )}
                {campaign.budget != null && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">${campaign.budget}</p>
                  </div>
                )}
                {campaign.dueDate && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Due</p>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {new Date(campaign.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
