import React from "react";
import type { PrintoutData } from "../../models/printout";

interface PrintoutSelectorProps {
  printouts: (PrintoutData & { id: string })[];
  selectedPrintoutId: string;
  onSelectPrintout: (id: string) => void;
  locked?: boolean;
}

const PrintoutSelector: React.FC<PrintoutSelectorProps> = ({
  printouts,
  selectedPrintoutId,
  onSelectPrintout,
  locked,
}) => {
  if (printouts.length === 0) return null;

  const selectedName = printouts.find((p) => p.id === selectedPrintoutId)?.name;

  if (locked && selectedPrintoutId) {
    return (
      <div className="flex items-center gap-2">
        <label className="text-sm text-gray-600 dark:text-gray-400">Active flyer:</label>
        <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedName}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600 dark:text-gray-400">Active flyer:</label>
      <select
        value={selectedPrintoutId}
        onChange={(e) => onSelectPrintout(e.target.value)}
        className="text-sm border border-gray-300 dark:border-gray-600 rounded-md px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
      >
        <option value="">Select a flyer...</option>
        {printouts.map((p) => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
};

export default PrintoutSelector;
