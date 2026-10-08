import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { CampaignRepository } from "../../repositories/campaignRepository";
import type { CampaignData } from "../../models/campaign";
import {
  computePortfolioState,
  getPrimaryAttentionFlag,
  getAttentionFlagLabel,
  getAttentionFlagDescription,
  PortfolioSection,
  PortfolioLoadingState,
} from "../../models/clientHomeDecisionModel";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

type CampaignWithId = CampaignData & { id: string };

interface CampaignCardProps {
  campaign: CampaignWithId;
}

function AttentionBadge({ campaign }: CampaignCardProps) {
  const primaryFlag = getPrimaryAttentionFlag(campaign);
  if (!primaryFlag) return null;

  const label = getAttentionFlagLabel(primaryFlag);
  const description = getAttentionFlagDescription(primaryFlag);

  return (
    <div
      role="status"
      aria-label={`Attention needed: ${label}`}
      title={description}
      className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800 dark:bg-red-950/40 dark:text-red-200"
    >
      <span aria-hidden="true">⚠</span>
      <span className="hidden sm:inline">{label}</span>
    </div>
  );
}

function CampaignCard({ campaign }: CampaignCardProps) {
  const location = [campaign.suburb, campaign.postcode].filter(Boolean).join(" ");
  const detail = [campaign.streetName, location].filter(Boolean).join(" · ");
  const primaryFlag = getPrimaryAttentionFlag(campaign);
  const hasAttention = primaryFlag !== null;
  const isActive = campaign.status === "assigned" || campaign.status === "ready";

  return (
    <article
      role="article"
      aria-label={`${campaign.name}, ${campaign.status}${campaign.suburb ? `, ${campaign.suburb}` : ""}`}
      className={`rounded-xl border bg-white shadow-sm transition dark:bg-gray-800 ${
        hasAttention
          ? "border-red-200 hover:border-red-400 dark:border-red-900/60 dark:hover:border-red-700"
          : "border-gray-200 hover:border-emerald-400 dark:border-gray-700 dark:hover:border-emerald-500"
      }`}
    >
      <Link to={`/app/campaign/${campaign.id}`} className="block p-5 hover:shadow-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
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

        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
          {campaign.totalDoors != null && <span>{campaign.totalDoors} doors</span>}
          {campaign.budget != null && <span>${campaign.budget.toLocaleString()} budget</span>}
          {campaign.dueDate && <span>Due {new Date(campaign.dueDate).toLocaleDateString()}</span>}
        </div>

        {isActive && (
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-600 dark:text-gray-400">
            <span aria-label="Walker status">
              {campaign.assignedWalkerId ? "✓ Walker assigned" : "Looking for walker"}
            </span>
          </div>
        )}

        {hasAttention && (
          <div className="mt-3">
            <AttentionBadge campaign={campaign} />
          </div>
        )}

        <span className="mt-4 inline-flex items-center text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Manage campaign <span aria-hidden="true" className="ml-1">→</span>
        </span>
      </Link>
    </article>
  );
}

interface PortfolioSectionProps {
  title: string;
  count: number;
  isEmpty: boolean;
  campaigns: CampaignWithId[];
  emptyMessage: string;
}

function PortfolioSectionView({
  title,
  count,
  isEmpty,
  campaigns,
  emptyMessage,
}: PortfolioSectionProps) {
  if (isEmpty && campaigns.length === 0) {
    return null;
  }

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        {count > 0 && <span className="text-sm text-gray-500 dark:text-gray-400">{count}</span>}
      </div>
      {campaigns.length === 0 ? (
        <div className="rounded-xl bg-white p-6 text-sm text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-400">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      )}
    </section>
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

  const portfolio = useMemo(
    () => computePortfolioState(campaigns.length > 0 ? campaigns : null, loading, error ? new Error(error) : null),
    [campaigns, loading, error],
  );

  const sectionOrder = [
    PortfolioSection.ATTENTION_NEEDED,
    PortfolioSection.BLOCKED,
    PortfolioSection.ACTIVE,
    PortfolioSection.DRAFT,
    PortfolioSection.COMPLETED,
  ];

  const sectionTitles: Record<string, string> = {
    [PortfolioSection.ATTENTION_NEEDED]: "Needs your attention",
    [PortfolioSection.BLOCKED]: "Blocked",
    [PortfolioSection.ACTIVE]: "Active campaigns",
    [PortfolioSection.DRAFT]: "Draft campaigns",
    [PortfolioSection.COMPLETED]: "Past campaigns",
  };

  const emptyMessages: Record<string, string> = {
    [PortfolioSection.ATTENTION_NEEDED]: "No campaigns need attention right now.",
    [PortfolioSection.BLOCKED]: "No blocked campaigns.",
    [PortfolioSection.ACTIVE]: "No active campaigns. Create one when you’re ready to plan your next delivery.",
    [PortfolioSection.DRAFT]: "No draft campaigns. Start a new campaign when you’re ready.",
    [PortfolioSection.COMPLETED]: "No completed campaigns yet.",
  };

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

      {portfolio.loadingState === PortfolioLoadingState.LOADING ? (
        <div
          className="flex justify-center py-16"
          role="status"
          aria-label="Loading campaigns"
          aria-live="polite"
        >
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
        </div>
      ) : portfolio.loadingState === PortfolioLoadingState.ERROR ? (
        <section
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20"
        >
          <p className="font-medium text-red-900 dark:text-red-200">Unable to load campaigns</p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{portfolio.error}</p>
          <button
            type="button"
            onClick={() => void loadCampaigns()}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-800"
          >
            Try again
          </button>
        </section>
      ) : portfolio.loadingState === PortfolioLoadingState.EMPTY_FIRST_TIME ? (
        <section
          role="status"
          className="rounded-xl bg-white p-8 text-center shadow-sm dark:bg-gray-800 sm:p-12"
        >
          <div
            className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl dark:bg-emerald-900/30"
            aria-hidden="true"
          >
            📬
          </div>
          <h2 className="mt-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Create your first campaign
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-gray-600 dark:text-gray-400">
            Choose the suburb you want to reach, add delivery areas, then publish when it’s ready for a walker.
          </p>
          <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              to="/app/setup"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Create a campaign
            </Link>
            <Link
              to="/app/flyers"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Upload a flyer first
            </Link>
          </div>
        </section>
      ) : (
        <>
          {sectionOrder.map((section) => (
            <PortfolioSectionView
              key={section}
              title={sectionTitles[section]}
              count={portfolio.sections[section]?.length ?? 0}
              isEmpty={false}
              campaigns={portfolio.sections[section] ?? []}
              emptyMessage={emptyMessages[section]}
            />
          ))}
        </>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          to="/app/properties"
          className="rounded-xl border border-blue-200 bg-blue-50 p-4 transition hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/20 dark:hover:bg-blue-950/40"
        >
          <h2 className="font-semibold text-blue-900 dark:text-blue-100">Delivery addresses</h2>
          <p className="mt-1 text-sm text-blue-800 dark:text-blue-200">
            Review the addresses used across your campaigns.
          </p>
        </Link>
        <Link
          to="/app/walkers"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 transition hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/20 dark:hover:bg-amber-950/40"
        >
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">Find walkers</h2>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Review interested walkers and delivery options.
          </p>
        </Link>
      </section>
    </div>
  );
}
