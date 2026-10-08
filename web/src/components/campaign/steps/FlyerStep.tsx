import React, { useState, useEffect } from "react";
import { FlyerRepository, type FlyerWithId } from "../../../repositories/flyerRepository";
import { uploadFile as uploadFlyer } from "../../../utils/storageUpload";
import type { CampaignData } from "../../../models/campaign";

interface FlyerStepProps {
  data: Partial<CampaignData>;
  onChange: (data: Partial<CampaignData>) => void;
  currentUserId?: string;
  isLoading?: boolean;
}

type SelectionMode = "library" | "upload" | "none";

const FlyerStep: React.FC<FlyerStepProps> = ({ data, onChange, currentUserId, isLoading = false }) => {
  const [mode, setMode] = useState<SelectionMode>("none");
  const [flyers, setFlyers] = useState<FlyerWithId[]>([]);
  const [flyersLoading, setFlyersLoading] = useState(false);
  const [selectedLibraryId, setSelectedLibraryId] = useState<string>("");

  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadSaving, setUploadSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load library flyers
  useEffect(() => {
    if (!currentUserId || mode !== "library") return;

    const loadFlyers = async () => {
      setFlyersLoading(true);
      try {
        const data = await FlyerRepository.getFlyers(currentUserId);
        const activeFlyers = data.filter((f) => !f.archivedAt);
        setFlyers(activeFlyers);
      } catch (err) {
        console.error("Failed to load flyers:", err);
        setError("Failed to load your flyer library. Please try again.");
      } finally {
        setFlyersLoading(false);
      }
    };

    void loadFlyers();
  }, [mode, currentUserId]);

  const handleSelectLibrary = (flyerId: string) => {
    setSelectedLibraryId(flyerId);
    setError(null);
  };

  const handleConfirmLibrary = async () => {
    if (!selectedLibraryId || !currentUserId) {
      setError("Please select a flyer");
      return;
    }

    const flyer = flyers.find((f) => f.id === selectedLibraryId);
    if (!flyer) {
      setError("Flyer not found");
      return;
    }

    try {
      setError(null);
      onChange({
        ...data,
        activePrintoutId: selectedLibraryId,
      });
      setMode("none");
    } catch (err) {
      console.error("Failed to attach flyer:", err);
      setError("Failed to attach flyer. Please try again.");
    }
  };

  const handleUploadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (uploadPreview) URL.revokeObjectURL(uploadPreview);
    setUploadFile(file);
    setUploadPreview(file ? URL.createObjectURL(file) : null);
  };

  const handleUploadFlyer = async () => {
    if (!uploadName.trim()) {
      setError("Flyer name is required");
      return;
    }
    if (!uploadFile) {
      setError("Please select an image file");
      return;
    }
    if (!currentUserId) {
      setError("User ID not available");
      return;
    }

    setUploadSaving(true);
    setError(null);
    try {
      const ext = uploadFile.name.split(".").pop() || "jpg";
      await uploadFlyer(
        `users/${currentUserId}/flyers/${Date.now()}.${ext}`,
        uploadFile
      );

      onChange({
        ...data,
        activePrintoutId: "temp-upload", // Will be set after campaign creation
      });

      setUploadName("");
      setUploadDesc("");
      if (uploadPreview) URL.revokeObjectURL(uploadPreview);
      setUploadFile(null);
      setUploadPreview(null);
      setMode("none");
    } catch (err) {
      console.error("Failed to upload flyer:", err);
      setError("Failed to upload flyer. Please try again.");
    } finally {
      setUploadSaving(false);
    }
  };

  const hasSelection = data.activePrintoutId !== undefined && data.activePrintoutId !== null;

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Flyer selection</legend>

      {hasSelection && mode === "none" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            ✓ Flyer selected ({data.activePrintoutId})
          </p>
          <button
            type="button"
            onClick={() => setMode("library")}
            className="mt-2 text-sm text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Change flyer
          </button>
        </div>
      )}

      {mode === "none" && !hasSelection && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">Select a flyer to deliver or upload a new one:</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("library")}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/30 font-medium text-sm disabled:opacity-50 transition-colors"
            >
              Select from library
            </button>
            <button
              type="button"
              onClick={() => setMode("upload")}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 font-medium text-sm disabled:opacity-50 transition-colors"
            >
              Upload new
            </button>
          </div>
        </div>
      )}

      {mode === "library" && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Select from your library</h3>

          {flyersLoading ? (
            <div className="text-center py-6">
              <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : flyers.length === 0 ? (
            <p className="text-sm text-gray-600 dark:text-gray-400">No flyers in your library. Upload one first.</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {flyers.map((flyer) => (
                <label
                  key={flyer.id}
                  className="flex items-start p-3 border rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <input
                    type="radio"
                    name="library-flyer"
                    value={flyer.id}
                    checked={selectedLibraryId === flyer.id}
                    onChange={(e) => handleSelectLibrary(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{flyer.name}</p>
                    {flyer.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{flyer.description}</p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}

          <div className="flex gap-2 border-t pt-3">
            <button
              type="button"
              onClick={() => setMode("none")}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLibrary}
              disabled={!selectedLibraryId}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Confirm
            </button>
          </div>
        </div>
      )}

      {mode === "upload" && (
        <div className="space-y-4 border-t pt-4">
          <h3 className="font-medium text-gray-900 dark:text-gray-100">Upload a new flyer</h3>

          <div>
            <label htmlFor="upload-name" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Flyer name <span className="text-red-500">*</span>
            </label>
            <input
              id="upload-name"
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="e.g., Summer Sale"
              disabled={uploadSaving}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="upload-desc" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Description <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="upload-desc"
              type="text"
              value={uploadDesc}
              onChange={(e) => setUploadDesc(e.target.value)}
              placeholder="Any details..."
              disabled={uploadSaving}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="upload-file" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Upload image <span className="text-red-500">*</span>
            </label>
            {uploadPreview && (
              <img
                src={uploadPreview}
                alt="Preview"
                className="w-32 h-32 object-cover rounded-lg mb-2 border border-gray-200 dark:border-gray-600"
              />
            )}
            <input
              id="upload-file"
              type="file"
              accept="image/*"
              onChange={handleUploadFile}
              disabled={uploadSaving}
              className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 dark:file:bg-blue-900/30 dark:file:text-blue-300 hover:file:bg-blue-100 disabled:opacity-50"
            />
          </div>

          <div className="flex gap-2 border-t pt-3">
            <button
              type="button"
              onClick={() => setMode("none")}
              disabled={uploadSaving}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUploadFlyer}
              disabled={uploadSaving || !uploadName.trim() || !uploadFile}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {uploadSaving ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
          {error}
        </div>
      )}
    </fieldset>
  );
};

export default FlyerStep;
