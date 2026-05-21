import React from "react";

interface AssignedWalkerCardProps {
  walkerName: string;
  onUnassign: () => void;
  unassigning: boolean;
  isCampaignClosed: boolean;
}

const AssignedWalkerCard: React.FC<AssignedWalkerCardProps> = ({
  walkerName,
  onUnassign,
  unassigning,
  isCampaignClosed,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Assigned Walker</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {walkerName}
          </p>
        </div>
        {!isCampaignClosed && (
          <button
            onClick={onUnassign}
            disabled={unassigning}
            className="px-3 py-1.5 text-sm border border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
          >
            Unassign
          </button>
        )}
      </div>
    </div>
  );
};

export default AssignedWalkerCard;
