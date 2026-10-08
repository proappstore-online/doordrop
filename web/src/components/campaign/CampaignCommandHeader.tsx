import React from "react";
import type { CampaignStatus, CampaignData } from "../../models/campaign";
import { getCampaignStatusLabel, getCampaignStatusBadgeColor } from "../../models/campaign";

interface CampaignCommandHeaderProps {
  campaign: Partial<CampaignData>;
  nextActions: CampaignStatus[];
  onActionClick: (status: CampaignStatus) => void;
  actionUpdating: boolean;
  isAdmin: boolean;
}

const LIFECYCLE_STAGES = ["draft", "ready", "assigned", "complete", "review", "payment", "archive"] as const;

const STAGE_DESCRIPTIONS: Record<CampaignStatus, string> = {
  draft: "Set up your campaign—add location, delivery area, and flyer",
  ready: "Published and waiting for walkers to show interest",
  assigned: "Walker assigned and ready to deliver",
  complete: "Delivery complete—move to review",
  review: "Campaign under review",
  payment: "Processing payment",
  archive: "Campaign archived",
};

const CampaignCommandHeader: React.FC<CampaignCommandHeaderProps> = ({
  campaign,
  nextActions,
  onActionClick,
  actionUpdating,
  isAdmin,
}) => {
  if (!campaign.status) return null;

  const currentStageIndex = campaign.status ? LIFECYCLE_STAGES.indexOf(campaign.status) : -1;
  const statusLabel = getCampaignStatusLabel(campaign.status as any);
  const statusColors = getCampaignStatusBadgeColor(campaign.status as any);

  return (
    <header
      role="banner"
      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border-b border-gray-200 dark:border-gray-700"
    >
      {/* Top row: Status badge and campaign name */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {campaign.name || "Untitled Campaign"}
          </h1>
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 text-sm font-semibold rounded-full ${statusColors}`}
              aria-label={`Campaign status: ${statusLabel}`}
            >
              {statusLabel}
            </span>
            {campaign.suburb && campaign.postcode && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {campaign.suburb} {campaign.postcode}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Status description */}
      {campaign.status && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {STAGE_DESCRIPTIONS[campaign.status as CampaignStatus]}
        </p>
      )}

      {/* Progress stepper */}
      <div className="mb-6 overflow-x-auto">
        <div className="flex gap-2 min-w-min pb-2">
          {LIFECYCLE_STAGES.map((stage: CampaignStatus, idx) => {
            const isActive = stage === (campaign.status as CampaignStatus);
            const isCompleted = idx < currentStageIndex;
            return (
              <div key={stage} className="flex items-center">
                <div
                  className={`flex items-center justify-center h-8 w-8 rounded-full text-xs font-semibold ${
                    isActive
                      ? "bg-blue-600 text-white"
                      : isCompleted
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                  aria-current={isActive ? "step" : undefined}
                  aria-label={`${getCampaignStatusLabel(stage)}: ${isActive ? "current step" : isCompleted ? "completed" : "pending"}`}
                >
                  {isCompleted ? "✓" : idx + 1}
                </div>
                {idx < LIFECYCLE_STAGES.length - 1 && (
                  <div
                    className={`h-1 w-6 mx-1 ${
                      isCompleted ? "bg-emerald-600" : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Next action CTAs */}
      {isAdmin && nextActions.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {nextActions.map((action) => (
            <button
              key={action}
              onClick={() => onActionClick(action)}
              disabled={actionUpdating}
              className="px-4 py-2 text-sm font-medium rounded-lg transition-colors
                bg-blue-600 hover:bg-blue-700 text-white
                disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label={`Move campaign to ${getCampaignStatusLabel(action)}`}
            >
              {action === "ready" && "Publish"}
              {action === "archive" && "Archive"}
              {action === "complete" && "Mark Complete"}
              {action === "review" && "Move to Review"}
              {action === "payment" && "Move to Payment"}
              {action === "assigned" && "Assign Walker"}
              {action === "draft" && "Back to Draft"}
            </button>
          ))}
        </div>
      )}
    </header>
  );
};

export default CampaignCommandHeader;
