import React, { useState } from "react";
import type { CampaignStatus, CampaignData } from "../../models/campaign";

interface CampaignNoticesProps {
  campaignStatus: CampaignStatus;
  isCampaignClosed: boolean;
  isWalker: boolean;
  isAssignedWalker: boolean;
  isAdmin?: boolean;
  campaignData?: Partial<CampaignData>;
  totalDoors?: number;
}

const CampaignNotices: React.FC<CampaignNoticesProps> = ({
  campaignStatus,
  isCampaignClosed: closed,
  isWalker,
  isAssignedWalker,
  isAdmin = false,
  campaignData,
  totalDoors = 0,
}) => {
  const [dismissedPublishNotice, setDismissedPublishNotice] = useState(false);

  // Calculate what's missing for publish readiness
  const hasLocation = Boolean(campaignData?.suburb && campaignData?.postcode && campaignData?.state);
  const hasDeliveryArea = Boolean(campaignData?.doorRadiusM && campaignData?.doorRadiusM > 0);
  const hasFlyer = Boolean(campaignData?.activePrintoutId);
  const hasDoors = totalDoors > 0;

  const missingItems: string[] = [];
  if (!hasLocation) missingItems.push("location");
  if (!hasDeliveryArea) missingItems.push("delivery area");
  if (!hasFlyer) missingItems.push("active flyer");
  if (!hasDoors) missingItems.push("delivery locations");

  const isDraft = campaignStatus === "draft";
  const showPublishNotice = isDraft && isAdmin && missingItems.length > 0 && !dismissedPublishNotice;

  return (
    <>
      {closed && (
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm text-gray-600 dark:text-gray-400">
          This campaign is {campaignStatus}. Editing is disabled.
        </div>
      )}

      {isWalker && !isAssignedWalker && !closed && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
          You are not assigned to this campaign yet. Door delivery tracking is view-only until you are assigned.
        </div>
      )}

      {showPublishNotice && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Ready to publish? Complete these items first:
              </p>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-0.5 list-disc list-inside">
                {missingItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setDismissedPublishNotice(true)}
              className="flex-shrink-0 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              aria-label="Dismiss notice"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default CampaignNotices;
