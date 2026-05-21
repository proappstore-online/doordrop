import React from "react";

interface CampaignDetailsEditorProps {
  budget: string;
  dueDate: string;
  doorRadius: string;
  junkMailPolicy: "deliver" | "skip";
  propertyFilter: "all" | "residential" | "commercial";
  doorCount: number;
  saving: boolean;
  onBudgetChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onDoorRadiusChange: (value: string) => void;
  onJunkMailPolicyChange: (value: "deliver" | "skip") => void;
  onPropertyFilterChange: (value: "all" | "residential" | "commercial") => void;
  onSave: () => void;
  onPublish: () => void;
  publishDisabled: boolean;
}

const CampaignDetailsEditor: React.FC<CampaignDetailsEditorProps> = ({
  budget,
  dueDate,
  doorRadius,
  junkMailPolicy,
  propertyFilter,
  doorCount,
  saving,
  onBudgetChange,
  onDueDateChange,
  onDoorRadiusChange,
  onJunkMailPolicyChange,
  onPropertyFilterChange,
  onSave,
  onPublish,
  publishDisabled,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Campaign Settings</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Budget ($)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={budget}
            onChange={(e) => onBudgetChange(e.target.value)}
            placeholder="e.g. 50"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Due Date</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => onDueDateChange(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Door Radius (m)</label>
          <input
            type="number"
            min="10"
            step="10"
            value={doorRadius}
            onChange={(e) => onDoorRadiusChange(e.target.value)}
            placeholder="e.g. 100"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Junk Mail Policy</label>
          <select
            value={junkMailPolicy}
            onChange={(e) => onJunkMailPolicyChange(e.target.value as "deliver" | "skip")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="deliver">Deliver anyway</option>
            <option value="skip">Skip "No Junk Mail"</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Property Filter</label>
          <select
            value={propertyFilter}
            onChange={(e) => onPropertyFilterChange(e.target.value as "all" | "residential" | "commercial")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All properties</option>
            <option value="residential">Residential only</option>
            <option value="commercial">Commercial only</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={onSave}
            disabled={saving}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={onPublish}
            disabled={publishDisabled}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Publish
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Doors: {doorCount}
        {doorCount === 0 && " — Add streets below before publishing"}
      </p>
    </div>
  );
};

export default CampaignDetailsEditor;
