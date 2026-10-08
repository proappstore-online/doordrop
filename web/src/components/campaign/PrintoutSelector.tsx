import React, { useState } from "react";
import type { PrintoutData } from "../../models/printout";

interface PrintoutSelectorProps {
  printouts: (PrintoutData & { id: string })[];
  selectedPrintoutId: string;
  onSelectPrintout: (id: string) => void;
  locked?: boolean;
  error?: string | null;
  onDismissError?: () => void;
}

const PrintoutSelector: React.FC<PrintoutSelectorProps> = ({
  printouts,
  selectedPrintoutId,
  onSelectPrintout,
  locked,
  error,
  onDismissError,
}) => {
  const [isUpdating, setIsUpdating] = useState(false);

  if (printouts.length === 0) return null;

  const selectedName = printouts.find((p) => p.id === selectedPrintoutId)?.name;

  const handleSelectChange = async (value: string) => {
    setIsUpdating(true);
    try {
      await onSelectPrintout(value);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClear = async () => {
    setIsUpdating(true);
    try {
      await onSelectPrintout("");
    } finally {
      setIsUpdating(false);
    }
  };

  if (locked) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">Active flyer:</label>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {selectedName || "(none)"}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-900/60 dark:bg-red-950/20">
          <svg
            className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div className="flex-1">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
          {onDismissError && (
            <button
              onClick={onDismissError}
              className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
            >
              ✕
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Active flyer:</label>
        <div className="flex gap-2">
          <select
            value={selectedPrintoutId}
            onChange={(e) => void handleSelectChange(e.target.value)}
            disabled={isUpdating}
            className="flex-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">Select a flyer...</option>
            {printouts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {selectedPrintoutId && (
            <button
              onClick={handleClear}
              disabled={isUpdating}
              className="px-3 py-1 text-sm border border-red-300 text-red-700 rounded-md hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              title="Clear the active flyer selection"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrintoutSelector;
