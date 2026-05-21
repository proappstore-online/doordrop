import React from "react";
import type { CampaignStatus } from "../../models/campaign";

interface CampaignNoticesProps {
  campaignStatus: CampaignStatus;
  isCampaignClosed: boolean;
  isWalker: boolean;
  isAssignedWalker: boolean;
}

const CampaignNotices: React.FC<CampaignNoticesProps> = ({
  campaignStatus,
  isCampaignClosed,
  isWalker,
  isAssignedWalker,
}) => {
  return (
    <>
      {isCampaignClosed && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
          This campaign is {campaignStatus}. Editing is disabled.
        </div>
      )}

      {isWalker && !isAssignedWalker && !isCampaignClosed && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
          You are not assigned to this campaign yet. Door delivery tracking is view-only until you are assigned.
        </div>
      )}
    </>
  );
};

export default CampaignNotices;
