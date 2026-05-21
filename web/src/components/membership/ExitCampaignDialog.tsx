import React from "react";

interface ExitCampaignDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onExit: () => void;
  confirmInput: string;
  onConfirmInputChange: (value: string) => void;
  loading: boolean;
}

const ExitCampaignDialog: React.FC<ExitCampaignDialogProps> = ({
  isOpen,
  onClose,
  onExit,
  confirmInput,
  onConfirmInputChange,
  loading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Confirm Exit</h2>
        </div>
        <div className="p-6">
          <p className="text-gray-900 dark:text-gray-100 mb-4">
            To exit the campaign, please type <b>"I confirm"</b> below:
          </p>
          <input
            type="text"
            placeholder="Type I confirm"
            value={confirmInput}
            onChange={(e) => onConfirmInputChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onExit}
            disabled={loading || confirmInput !== "I confirm"}
            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-red-400 disabled:opacity-70"
          >
            {loading ? "Exiting..." : "Exit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExitCampaignDialog;
