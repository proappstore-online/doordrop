import React from "react";
import type { CampaignData } from "../../models/campaign";
import type { PrintoutData } from "../../models/printout";

type PrintoutWithId = PrintoutData & { id: string };

interface CampaignFlyerPanelProps {
  campaign: Partial<CampaignData>;
  printouts: PrintoutWithId[];
  onSelectFlyer: (id: string | undefined) => void;
  isAdmin: boolean;
}

const CampaignFlyerPanel: React.FC<CampaignFlyerPanelProps> = ({
  campaign,
  printouts,
  onSelectFlyer,
  isAdmin,
}) => {
  const activePrintout = printouts.find((p) => p.id === campaign.activePrintoutId);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Active Flyer</h3>

      {activePrintout ? (
        <div className="flex gap-3">
          {activePrintout.fileUrl && (
            <img
              src={activePrintout.fileUrl}
              alt={activePrintout.name}
              className="h-24 w-24 rounded object-cover flex-shrink-0"
            />
          )}
          <div className="flex-1">
            <p className="font-medium text-gray-900 dark:text-gray-100">{activePrintout.name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">This is what walkers will deliver</p>
            {activePrintout.flyerId && (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">From your flyer library</p>
            )}
            {isAdmin && (campaign.status === "draft" || campaign.status === "ready") && (
              <button
                onClick={() => onSelectFlyer(undefined)}
                className="text-xs text-red-600 dark:text-red-400 hover:underline mt-2"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">No flyer selected</p>
          {isAdmin && (campaign.status === "draft" || campaign.status === "ready") && (
            <p className="text-xs text-gray-500 dark:text-gray-500">
              Select a flyer from your library or upload a new one to get started
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CampaignFlyerPanel;
