import React, { useEffect, useMemo, useState } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { UserRepository } from "../../repositories/userRepository";
import { useNavigate, Link } from "react-router-dom";
import type { CampaignData } from "../../models/campaign";
import type { DeliveryRunData } from "../../models/deliveryRun";
import { WalkerReviewRepository } from "../../repositories/walkerReviewRepository";
import { DeliveryRunRepository } from "../../repositories/deliveryRunRepository";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { timestampToDate } from "../../utils/timestampToDate";
import { useActiveCampaignTracking } from "../../hooks/useActiveCampaignTracking";
import LiveTrackingIndicator from "../../components/LiveTrackingIndicator";

type CampaignWithId = CampaignData & { id: string };
type DeliveryRunWithCampaign = DeliveryRunData & {
  id: string;
  campaignName: string;
};

const WalkerDashboardPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState<CampaignWithId[]>([]);
  const [upcomingRuns, setUpcomingRuns] = useState<DeliveryRunWithCampaign[]>(
    []
  );
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [totalCampaignsCompleted, setTotalCampaignsCompleted] = useState(0);
  const [totalDoorsDelivered, setTotalDoorsDelivered] = useState(0);
  const [totalKmWalked, setTotalKmWalked] = useState(0);

  // Track which campaigns are actively tracking
  const campaignIds = useMemo(() => campaigns.map((c) => c.id), [campaigns]);
  const activeCampaigns = useActiveCampaignTracking(campaignIds);

  useEffect(() => {
    async function load() {
      if (!currentUser) return;

      // Check profile completeness — redirect if needed
      const userDoc = await UserRepository.getUser(currentUser.id);
      const wp = userDoc?.walkerProfile;
      const profileComplete = !!wp && !!wp.postcode && !!wp.suburb;
      if (!profileComplete) {
        navigate("/walker/setup", { replace: true });
        return;
      }

      // Populate stats from walkerProfile
      setTotalCampaignsCompleted(wp.totalCampaignsCompleted || 0);
      setTotalDoorsDelivered(wp.totalDoorsDelivered || 0);
      setTotalKmWalked(wp.totalKmWalked || 0);

      // Fetch assigned campaigns
      const myCampaigns: CampaignWithId[] =
        await CampaignRepository.getCampaignsByAssignedWalker(currentUser.id);
      setCampaigns(myCampaigns);

      // Fetch upcoming delivery runs for each campaign
      const now = new Date();
      const allRuns: DeliveryRunWithCampaign[] = [];
      for (const c of myCampaigns) {
        const runs = await DeliveryRunRepository.getSchedulesByCampaign(c.id);
        for (const r of runs) {
          const runDate = timestampToDate(r.date);
          if (runDate && runDate >= now && r.status !== "completed") {
            allRuns.push({ ...r, campaignName: c.name });
          }
        }
      }
      allRuns.sort(
        (a, b) =>
          (timestampToDate(a.date)?.getTime() ?? 0) - (timestampToDate(b.date)?.getTime() ?? 0)
      );
      setUpcomingRuns(allRuns.slice(0, 5));

      // Fetch reviews
      const reviewStats = await WalkerReviewRepository.getReviewStats(currentUser.id);
      setAvgRating(reviewStats.count > 0 ? reviewStats.average : null);
      setReviewCount(reviewStats.count);

      setLoading(false);
    }

    load();
  }, [currentUser, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Walker Dashboard
      </h1>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Active Campaigns</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{campaigns.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Campaigns Completed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCampaignsCompleted}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Doors Delivered</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalDoorsDelivered}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Km Walked</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalKmWalked ? totalKmWalked.toFixed(1) : "0"}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Avg Rating ({reviewCount})</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{avgRating !== null ? avgRating.toFixed(1) : "—"}</p>
        </div>
      </div>

      {/* My Campaigns */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          My Campaigns
        </h2>
        {campaigns.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No campaigns assigned yet.{" "}
            <Link
              to="/walker/streets"
              className="text-emerald-600 hover:underline"
            >
              Browse campaigns
            </Link>
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => {
              const isLive = activeCampaigns.has(c.id);
              return (
              <Link
                key={c.id}
                to={`/walker/campaign/${c.id}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 border border-gray-200 dark:border-gray-700 hover:border-emerald-400 transition-colors block no-underline"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {c.name}
                  </h3>
                  {isLive && <LiveTrackingIndicator size="md" showLabel />}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {c.suburb} {c.postcode}
                </p>
                <div className="flex gap-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {c.totalDoors != null && <span>{c.totalDoors} doors</span>}
                  {c.budget != null && <span>${c.budget}</span>}
                  {c.dueDate && (
                    <span>Due {new Date(c.dueDate).toLocaleDateString()}</span>
                  )}
                </div>
              </Link>
            );
            })}
          </div>
        )}
      </section>

      {/* Upcoming Deliveries */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Upcoming Deliveries
        </h2>
        {upcomingRuns.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400">
            No upcoming deliveries scheduled.
          </p>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <ul>
              {upcomingRuns.map((run, idx) => (
                <li key={run.id}>
                  <div className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        {run.campaignName}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {timestampToDate(run.date)?.toLocaleDateString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {run.status ?? "scheduled"}
                    </span>
                  </div>
                  {idx < upcomingRuns.length - 1 && (
                    <div className="border-t border-gray-200 dark:border-gray-700" />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Quick Links */}
      <section>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
          Quick Links
        </h2>
        <div className="flex gap-3">
          <Link
            to="/walker/streets"
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Browse Campaigns
          </Link>
          <Link
            to="/walker/history"
            className="px-4 py-2 border border-emerald-600 text-emerald-600 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          >
            View History
          </Link>
        </div>
      </section>
    </div>
  );
};

export default WalkerDashboardPage;
