import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CampaignRepository } from '../../repositories/campaignRepository';
import { Spinner } from './adminUi';

type CampaignRow = Awaited<ReturnType<typeof CampaignRepository.getAllGroups>>[number];

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    CampaignRepository.getAllGroups()
      .then(setCampaigns)
      .catch((err) => console.error('Failed to load campaigns:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Campaigns ({campaigns.length})</h1>
      <div className="grid gap-4">
        {campaigns.map((c) => (
          <Link
            key={c.id}
            to={`/admin/campaigns/${c.id}`}
            className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow no-underline"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-medium text-slate-900">{c.name}</h2>
                <p className="text-sm text-slate-500">
                  {c.suburb} {c.postcode} &middot; {c.totalDoors || 0} doors
                </p>
              </div>
              <div className="text-right">
                {c.jobStatus && (
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      c.jobStatus === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : c.jobStatus === 'posted'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {c.jobStatus}
                  </span>
                )}
                {c.budget != null && <p className="text-sm text-slate-500 mt-1">${c.budget}</p>}
              </div>
            </div>
          </Link>
        ))}
        {campaigns.length === 0 && <p className="text-center text-slate-500 py-8">No campaigns found.</p>}
      </div>
    </div>
  );
}
