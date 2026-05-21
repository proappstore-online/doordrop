import React from "react";
import type { CampaignData } from "../../models/campaign";

interface JoinCampaignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  campaigns: (CampaignData & { id: string })[];
  loading: boolean;
  errorMsg: string | null;
  requestingGroupIds: string[];
  submittedGroupIds: string[];
  onRequestJoin: (campaignId: string, campaign: CampaignData) => void;
}

const JoinCampaignDialog: React.FC<JoinCampaignDialogProps> = ({
  isOpen,
  onClose,
  campaigns,
  loading,
  errorMsg,
  requestingGroupIds,
  submittedGroupIds,
  onRequestJoin,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Nearby Campaigns</h2>
        </div>
        <div className="p-6 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-6">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : errorMsg ? (
            <p className="text-red-600 dark:text-red-400">{errorMsg}</p>
          ) : campaigns.length === 0 ? (
            <p className="text-gray-900 dark:text-gray-100">No groups available nearby.</p>
          ) : (
            campaigns.map((g) => (
              <div
                key={g.id}
                className="bg-gray-50 dark:bg-gray-700 rounded-lg shadow p-4 mb-3 flex justify-between items-center"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-gray-100">{g.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {g.suburb || "Location not specified"}
                  </p>
                </div>
                <button
                  onClick={() => onRequestJoin(g.id, g)}
                  disabled={requestingGroupIds.includes(g.id) || submittedGroupIds.includes(g.id)}
                  className="border border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  {requestingGroupIds.includes(g.id) ? "Requesting..." : submittedGroupIds.includes(g.id) ? "Requested" : "Request"}
                </button>
              </div>
            ))
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default JoinCampaignDialog;
