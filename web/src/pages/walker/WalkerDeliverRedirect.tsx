import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import type { CampaignData } from "../../models/campaign";
import { getPersistedSession } from "../../hooks/useDeliveryTracking";

type CampaignWithId = CampaignData & { id: string };

const WalkerDeliverRedirect: React.FC = () => {
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If there's an active tracking session, redirect immediately
    const session = getPersistedSession();
    if (session) {
      navigate(`/walker/campaign/${session.campaignId}/deliver`, { replace: true });
      return;
    }
    if (!currentUser) return;
    (async () => {
      const assigned = (await CampaignRepository.getCampaignsByAssignedWalker(currentUser.id))
        .filter((c) => c.status === "assigned");

      if (assigned.length === 1) {
        navigate(`/walker/campaign/${assigned[0].id}/deliver`, { replace: true });
        return;
      }
      setCampaigns(assigned);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [currentUser, navigate]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">No active campaigns assigned to you.</p>
        <Link to="/walker/streets" className="text-emerald-600 hover:underline">Browse campaigns</Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Choose a campaign to deliver</h1>
      <div className="space-y-3">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            to={`/walker/campaign/${c.id}/deliver`}
            className="block bg-white dark:bg-gray-800 rounded-lg shadow p-4 hover:shadow-md transition-shadow no-underline"
          >
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{c.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{c.suburb} {c.postcode}</p>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default WalkerDeliverRedirect;
