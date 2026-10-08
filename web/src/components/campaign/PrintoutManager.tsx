import React from "react";
import type { PrintoutData } from "../../models/printout";
import type { FlyerWithId } from "../../repositories/flyerRepository";

interface PrintoutManagerProps {
  printouts: (PrintoutData & { id: string })[];
  showForm: boolean;
  printoutName: string;
  printoutDesc: string;
  printoutFile: File | null;
  printoutFilePreview: string | null;
  flyers: FlyerWithId[];
  flyersLoading: boolean;
  selectedFlyerId: string;
  saving: boolean;
  isCampaignClosed: boolean;
  onToggleForm: () => void;
  onNameChange: (value: string) => void;
  onDescChange: (value: string) => void;
  onFileChange: (file: File | null, preview: string | null) => void;
  onFlyerSelect: (flyerId: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

const PrintoutManager: React.FC<PrintoutManagerProps> = ({
  printouts,
  showForm,
  printoutName,
  printoutDesc,
  printoutFile: _printoutFile,
  printoutFilePreview,
  flyers,
  flyersLoading,
  selectedFlyerId,
  saving,
  isCampaignClosed,
  onToggleForm,
  onNameChange,
  onDescChange,
  onFileChange,
  onFlyerSelect,
  onSubmit,
  onCancel,
}) => {
  const selectedFlyer = flyers.find((flyer) => flyer.id === selectedFlyerId);

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (printoutFilePreview) URL.revokeObjectURL(printoutFilePreview);
    const preview = file ? URL.createObjectURL(file) : null;
    onFlyerSelect("");
    onFileChange(file, preview);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Flyers ({printouts.length})
        </h2>
        {!isCampaignClosed && (
          <button
            onClick={onToggleForm}
            className="text-sm px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
          >
            + Add Flyer
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={onSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 mb-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Reuse a saved flyer <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={selectedFlyerId}
              onChange={(e) => onFlyerSelect(e.target.value)}
              disabled={flyersLoading}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">{flyersLoading ? "Loading your flyer library..." : "Upload a new flyer instead"}</option>
              {flyers.map((flyer) => (
                <option key={flyer.id} value={flyer.id}>{flyer.name}</option>
              ))}
            </select>
            {!flyersLoading && flyers.length === 0 && (
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">No saved flyers yet. Upload one below, or add flyers from the Flyers page.</p>
            )}
            {selectedFlyer && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-900/20">
                {selectedFlyer.fileUrl && (
                  <img src={selectedFlyer.fileUrl} alt={selectedFlyer.name} className="h-14 w-14 rounded object-cover" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Using “{selectedFlyer.name}” from your library</p>
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">Its name, notes, and image will be copied into this campaign.</p>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flyer name</label>
            <input
              type="text"
              value={printoutName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="e.g. Summer Sale, Grand Opening..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={printoutDesc}
              onChange={(e) => onDescChange(e.target.value)}
              placeholder="Any details about this flyer..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Upload image {selectedFlyer && <span className="text-gray-400 font-normal">(choose a file to use a new flyer instead)</span>}
            </label>
            {printoutFilePreview && (
              <img src={printoutFilePreview} alt="Preview" className="w-32 h-32 object-cover rounded-md mb-2" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={handleFileInputChange}
              className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 hover:file:bg-emerald-100"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !printoutName.trim()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {saving ? "Uploading..." : "Save Flyer"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {printouts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm divide-y divide-gray-100 dark:divide-gray-700">
          {printouts.map((p) => (
            <div key={p.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {p.fileUrl && (
                  <img src={p.fileUrl} alt={p.name} className="w-10 h-10 rounded object-cover flex-shrink-0" />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {p.name}
                  </span>
                  {p.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{p.description}</p>
                  )}
                  {p.flyerId && (
                    <p className="text-xs text-emerald-700 dark:text-emerald-300">From your flyer library</p>
                  )}
                </div>
              </div>
              <span className="text-xs text-gray-400">
                {p.createdAt instanceof Date ? p.createdAt.toLocaleDateString() : ""}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PrintoutManager;
