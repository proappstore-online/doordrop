import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import type { CampaignData } from "../../models/campaign";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

type CampaignWithId = CampaignData & { id: string };

const OPEN_STATUSES = new Set(["draft", "ready", "assigned"]);

function CampaignCard({ campaign }: { campaign: CampaignWithId }) {
  const location = [campaign.suburb, campaign.postcode].filter(Boolean).join(" ");
  const detail = [campaign.streetName, location].filter(Boolean).join(" · ");

  return (
    <Link
      to={`/app/campaign/${campaign.id}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-emerald-400 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 dark:hover:border-emerald-500"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-semibold text-gray-900 dark:text-gray-100">
            {campaign.name}
          </h3>
          {detail && <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{detail}</p>}
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${campaignStatusColors[campaign.status]}`}
        >
          {campaign.status}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
        {campaign.totalDoors != null && <span>{campaign.totalDoors} doors</span>}
        {campaign.budget != null && <span>${campaign.budget.toLocaleString()} budget</span>}
        {campaign.dueDate && <span>Due {new Date(campaign.dueDate).toLocaleDateString()}</span>}
      </div>
      <span className="mt-4 inline-flex items-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
        Manage campaign <span aria-hidden="true" className="ml-1">→</span>
      </span>
    </Link>
  );
}

export default function ClientDashboard() {
  const { currentUser } = useAuthContext();
  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCampaigns = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    setError(null);
    try {
      setCampaigns(await CampaignRepository.getCampaignsByUser(currentUser.id));
    } catch (err) {
      console.error("Failed to load client campaigns:", err);
      setError("We couldn’t load your campaigns. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const { openCampaigns, completedCampaigns } = useMemo(() => {
    const sorted = [...campaigns].sort((a, b) => {
      const aTime = a.updatedAt?.getTime() ?? a.createdAt?.getTime() ?? 0;
      const bTime = b.updatedAt?.getTime() ?? b.createdAt?.getTime() ?? 0;
      return bTime - aTime;
    });
    return {
      openCampaigns: sorted.filter((campaign) => OPEN_STATUSES.has(campaign.status)),
      completedCampaigns: sorted.filter((campaign) => !OPEN_STATUSES.has(campaign.status)),
    };
  }, [campaigns]);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-2 py-3 sm:px-4">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">Campaigns</h1>
          <p className="mt-1 text-gray-600 dark:text-gray-400">
            Plan, publish, and track your flyer delivery campaigns.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/app/flyers"
            className="rounded-lg border border-emerald-700 px-4 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950/30"
          >
            Manage flyers
          </Link>
          <Link
            to="/app/setup"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            + New campaign
          </Link>
        </div>
      </section>

      {loading ? (
        <div className="flex justify-center py-16" role="status" aria-label="Loading campaigns">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : error ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
          <p className="font-medium text-red-900 dark:text-red-200">Unable to load campaigns</p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{error}</p>
          <button
            type="button"
            onClick={() => void loadCampaigns()}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
          >
            Try again
          </button>
        </section>
      ) : campaigns.length === 0 ? (
        <section className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-gray-800 sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl dark:bg-emerald-900/30" aria-hidden="true">
            📬
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">Create your first campaign</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
            Choose the suburb you want to reach, add delivery areas, then publish when it’s ready for a walker.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/app/setup" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
              Create a campaign
            </Link>
            <Link to="/app/flyers" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700">
              Upload a flyer first
            </Link>
          </div>
        </section>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Active campaigns</h2>
              <span className="text-sm text-gray-500 dark:text-gray-400">{openCampaigns.length}</span>
            </div>
            {openCampaigns.length === 0 ? (
              <div className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-400">
                No active campaigns. Create one when you’re ready to plan your next delivery.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {openCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
              </div>
            )}
          </section>

          {completedCampaigns.length > 0 && (
            <section>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Past campaigns</h2>
                <span className="text-sm text-gray-500 dark:text-gray-400">{completedCampaigns.length}</span>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {completedCampaigns.map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}
              </div>
            </section>
          )}
        </>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/app/properties"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
        >
          <h2 className="font-semibold text-blue-900 dark:text-blue-100">Delivery addresses</h2>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">Review the addresses used across your campaigns.</p>
        </Link>
        <Link
          to="/app/walkers"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
        >
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">Find walkers</h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">Review interested walkers and delivery options.</p>
        </Link>
      </section>
    </div>
  );
}
