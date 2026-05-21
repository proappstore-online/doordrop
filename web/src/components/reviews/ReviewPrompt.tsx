import React from "react";

interface ReviewPromptProps {
  onRateNow: () => void;
  completedDate?: string;
  walkerName?: string;
}

const ReviewPrompt: React.FC<ReviewPromptProps> = ({ onRateNow, completedDate, walkerName }) => {
  return (
    <div className="mb-6 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-base font-medium text-gray-900 dark:text-gray-100">
            🌿 Your delivery was completed{completedDate ? ` on ${completedDate}` : ""}!
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            How did {walkerName || "your walker"} do?
          </p>
        </div>
        <button
          onClick={onRateNow}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
        >
          Leave Review →
        </button>
      </div>
    </div>
  );
};

export default ReviewPrompt;
