import React from "react";
import type { CampaignData } from "../../models/campaign";

interface CampaignStatsProps {
  campaign: CampaignData;
  totalDoors: number;
  deliveredCount: number;
  reportedCount: number;
}

const CampaignStats: React.FC<CampaignStatsProps> = ({
  campaign,
  totalDoors,
  deliveredCount,
  reportedCount,
}) => {
  const pct = totalDoors > 0 ? Math.round((deliveredCount / totalDoors) * 100) : 0;
  const remaining = totalDoors - deliveredCount - reportedCount;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Doors</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {campaign.totalDoors || totalDoors}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <p className="text-xs text-gray-500 dark:text-gray-400">Delivered</p>
          <p className="text-lg font-semibold text-emerald-600">
            {deliveredCount} / {totalDoors}
          </p>
        </div>
        {reportedCount > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400">Reported</p>
            <p className="text-lg font-semibold text-amber-500">
              {reportedCount}
            </p>
          </div>
        )}
        {campaign.budget != null && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400">Budget</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              ${campaign.budget}
            </p>
          </div>
        )}
        {campaign.dueDate && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
            <p className="text-xs text-gray-500 dark:text-gray-400">Due Date</p>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {new Date(campaign.dueDate).toLocaleDateString()}
            </p>
          </div>
        )}
      </div>
      {/* Progress bar */}
      {totalDoors > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Delivery Progress</span>
            <span className="text-sm font-semibold text-emerald-600">{pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {deliveredCount} delivered, {remaining} remaining{reportedCount > 0 ? `, ${reportedCount} reported` : ""}
          </p>
        </div>
      )}
    </div>
  );
};

export default CampaignStats;
