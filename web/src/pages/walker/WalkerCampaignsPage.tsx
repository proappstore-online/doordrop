import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import type { CampaignData } from "../../models/campaign";
import { useActiveCampaignTracking } from "../../hooks/useActiveCampaignTracking";
import LiveTrackingIndicator from "../../components/LiveTrackingIndicator";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

const WalkerCampaignsPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const [groups, setGroups] = useState<(CampaignData & { id: string })[]>(
    []
  );
  const [interestedGroupIds, setInterestedGroupIds] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(true);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);

  // Track which campaigns are actively tracking
  const groupIds = useMemo(() => groups.map((g) => g.id), [groups]);
  const activeCampaigns = useActiveCampaignTracking(groupIds);

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      try {
        const [activeCampaigns, myCampaigns, walkerInterests] = await Promise.all([
          CampaignRepository.getActiveCampaigns(),
          CampaignRepository.getCampaignsByAssignedWalker(currentUser.id),
          WalkerInterestRepository.getInterestsByWalker(currentUser.id),
        ]);
        // Merge and deduplicate
        const seen = new Set<string>();
        const merged: typeof activeCampaigns = [];
        for (const c of [...myCampaigns, ...activeCampaigns]) {
          if (!seen.has(c.id)) {
            seen.add(c.id);
            merged.push(c);
          }
        }
        setGroups(merged);
        setInterestedGroupIds(
          new Set(walkerInterests.map((interest) => interest.campaignId))
        );
      } catch (error) {
        console.error("Failed to load campaigns:", error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleExpressInterest = async (groupId: string) => {
    if (!currentUser) return;
    setSavingGroupId(groupId);
    try {
      await WalkerInterestRepository.createInterest({
        walkerId: currentUser.id,
        campaignId: groupId,
        createdAt: new Date(),
      });
      setInterestedGroupIds((prev) => new Set([...prev, groupId]));
    } catch (error) {
      console.error("Failed to express interest:", error);
    } finally {
      setSavingGroupId(null);
    }
  };

  const { myCampaigns, availableCampaigns } = useMemo(() => {
    const my: typeof groups = [];
    const available: typeof groups = [];

    groups.forEach((g) => {
      // My campaigns: assigned to me
      if (g.assignedWalkerId === currentUser?.id) {
        my.push(g);
      } else {
        // Available campaigns: active and not assigned to anyone
        const isActive = g.status === "ready" || g.status === "assigned" || (!g.status && (!g.jobStatus || g.jobStatus === "posted"));
        const isNotAssigned = !g.assignedWalkerId;
        if (isActive && isNotAssigned) {
          available.push(g);
        }
      }
    });

    // Sort both by name
    my.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    available.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return { myCampaigns: my, availableCampaigns: available };
  }, [groups, currentUser]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-2 md:p-3">
      <div className="space-y-1.5 mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Campaigns
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          View your assigned campaigns and browse available opportunities.
        </p>
      </div>

      {/* My Campaigns */}
      {myCampaigns.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
            My Campaigns ({myCampaigns.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {myCampaigns.map((group) => {
              const isLive = activeCampaigns.has(group.id);
              return (
              <div key={group.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md border-2 border-emerald-500/30 h-full">
                <div className="p-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                            {group.name}
                          </h3>
                          {isLive && <LiveTrackingIndicator size="md" showLabel />}
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">
                          {group.suburb} {group.postcode}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${campaignStatusColors[group.status] || campaignStatusColors.draft}`}>
                        {group.status}
                      </span>
                    </div>

                    <div className="space-y-1">
                      {group.streetName && (
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Street:</strong> {group.streetName}
                        </p>
                      )}
                      {group.totalDoors != null && (
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Doors:</strong> {group.totalDoors}
                        </p>
                      )}
                      {group.budget != null && (
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Budget:</strong> ${group.budget}
                        </p>
                      )}
                      {group.dueDate && (
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          <strong>Due:</strong> {new Date(group.dueDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    <Link
                      to={`/walker/campaign/${group.id}`}
                      className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
                    >
                      View Campaign
                    </Link>
                  </div>
                </div>
              </div>
            );
            })}
          </div>
        </div>
      )}

      {/* Available Campaigns */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Available Campaigns ({availableCampaigns.length})
        </h2>
        {availableCampaigns.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No campaigns available to join at the moment.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableCampaigns.map((group) => {
          const isInterested = interestedGroupIds.has(group.id);
          const isSaving = savingGroupId === group.id;
          const isAssignedToMe = group.assignedWalkerId === currentUser?.id;
          return (
            <div key={group.id} className={`bg-white dark:bg-gray-800 rounded-lg shadow-md h-full ${isAssignedToMe ? "ring-2 ring-emerald-500" : ""}`}>
              <div className="p-6">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                        {group.name}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {group.suburb} {group.postcode}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${campaignStatusColors[group.status] || campaignStatusColors.draft}`}>
                      {group.status}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {group.streetName && (
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Street:</strong> {group.streetName}
                      </p>
                    )}
                    {group.totalDoors != null && (
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Doors:</strong> {group.totalDoors}
                      </p>
                    )}
                    {group.budget != null && (
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Budget:</strong> ${group.budget}
                      </p>
                    )}
                    {group.dueDate && (
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        <strong>Due:</strong> {new Date(group.dueDate).toLocaleDateString()}
                      </p>
                    )}
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <strong>Members:</strong> {group.memberIds?.length || 0}
                    </p>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <Link
                      to={`/walker/campaign/${group.id}`}
                      className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium text-sm py-2"
                    >
                      View Details
                    </Link>
                    <button
                      onClick={() => handleExpressInterest(group.id)}
                      disabled={isInterested || isSaving}
                      className={`${
                        isInterested
                          ? "border border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          : "bg-emerald-600 hover:bg-emerald-700 text-white"
                      } font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {isInterested ? "Interested" : "Express interest"}
                    </button>
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
