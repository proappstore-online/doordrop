import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../hooks/useAuthContext';
import { CampaignRepository } from '../../repositories/campaignRepository';
import type { CampaignData } from '../../models/campaign';

type CampaignWithId = CampaignData & { id: string };

export default function ClientDashboard() {
  const { currentUser } = useAuthContext();
  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCampaigns = async () => {
      if (!currentUser) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await CampaignRepository.getCampaignsByUser(currentUser.id);
        setCampaigns(data);
      } catch (err) {
        console.error('Failed to load campaigns:', err);
        setError('Failed to load campaigns. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadCampaigns();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">My Campaigns</h1>
        <Link
          to="/app/setup"
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
        >
          + New Campaign
        </Link>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {campaigns.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            You haven't created any campaigns yet.
          </p>
          <Link
            to="/app/setup"
            className="inline-block px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium"
          >
            Create Your First Campaign
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Link
              key={campaign.id}
              to={`/app/campaign/${campaign.id}`}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:border-emerald-400 dark:hover:border-emerald-400 transition-colors no-underline"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {campaign.name}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {campaign.suburb} {campaign.postcode}
              </p>
              <div className="flex gap-4 text-sm text-gray-600 dark:text-gray-400">
                {campaign.totalDoors && <span>{campaign.totalDoors} doors</span>}
                {campaign.budget && <span>${campaign.budget}</span>}
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="inline-block px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-200 text-xs rounded font-medium">
                  {campaign.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/app/properties"
          className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors no-underline"
        >
          <h3 className="font-semibold text-blue-900 dark:text-blue-200 mb-1">Properties</h3>
          <p className="text-sm text-blue-700 dark:text-blue-300">Manage delivery addresses</p>
        </Link>

        <Link
          to="/app/flyers"
          className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors no-underline"
        >
          <h3 className="font-semibold text-purple-900 dark:text-purple-200 mb-1">Flyers</h3>
          <p className="text-sm text-purple-700 dark:text-purple-300">Upload printouts</p>
        </Link>

        <Link
          to="/app/walkers"
          className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors no-underline"
        >
          <h3 className="font-semibold text-amber-900 dark:text-amber-200 mb-1">Walkers</h3>
          <p className="text-sm text-amber-700 dark:text-amber-300">Discover local walkers</p>
        </Link>
      </div>
    </div>
  );
}
