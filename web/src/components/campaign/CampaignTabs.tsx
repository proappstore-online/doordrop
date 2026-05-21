import React from "react";
import { Link, useLocation } from "react-router-dom";
import type { CampaignStatus } from "../../models/campaign";
import { campaignStatusColors } from "../../utils/campaignStatusColors";

interface CampaignTabsProps {
  campaignId: string;
  campaignName: string;
  status?: string;
  campaignStatus?: CampaignStatus;
}

const CampaignTabs: React.FC<CampaignTabsProps> = ({ campaignId, campaignName, status, campaignStatus }) => {
  const location = useLocation();
  const prefix = location.pathname.startsWith("/walker") ? "/walker" : "/app";
  const basePath = `${prefix}/campaign/${campaignId}`;

  const tabs = [
    { label: "Overview", to: basePath },
  ];

  const dashboardPath = prefix === "/walker" ? "/walker" : "/app";

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
              {campaignName}
            </h1>
            {campaignStatus && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${campaignStatusColors[campaignStatus]}`}>
                {campaignStatus}
              </span>
            )}
          </div>
          {status && (
            <span className="text-sm text-gray-500 dark:text-gray-400">{status}</span>
          )}
        </div>
        <Link
          to={dashboardPath}
          className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline no-underline"
        >
          Back to Dashboard
        </Link>
      </div>
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors no-underline ${
                isActive
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignTabs;
