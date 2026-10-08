import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { FlyerRepository, type CampaignDependency } from "../../repositories/flyerRepository";
import type { FlyerData } from "../../models/flyer";
import { uploadFile } from "../../utils/storageUpload";

type Feedback = { type: "success" | "error"; message: string };
type SortKey = "name" | "date" | "usage";
type FlyerWithCampaigns = (FlyerData & { id: string }) & { campaigns?: CampaignDependency[] };

const FlyersPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [flyers, setFlyers] = useState<FlyerWithCampaigns[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("date");
  const [campaignCounts, setCampaignCounts] = useState<Record<string, number>>({});

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editFile, setEditFile] = useState<File | null>(null);
  const [editFilePreview, setEditFilePreview] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadFlyers = useCallback(async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const data = await FlyerRepository.getFlyers(currentUser.id);
      setFlyers(data);

      // Load campaign usage counts for each flyer
      const counts: Record<string, number> = {};
      await Promise.all(
        data.map(async (flyer) => {
          try {
            const campaigns = await FlyerRepository.getCampaignsUsingFlyer(currentUser.id, flyer.id);
            counts[flyer.id] = campaigns.length;
          } catch (err) {
            console.warn(`Failed to load campaigns for flyer ${flyer.id}:`, err);
            counts[flyer.id] = 0;
          }
        })
      );
      setCampaignCounts(counts);
    } catch (err) {
      console.error("Failed to load flyers:", err);
      setLoadError("We couldn’t load your flyers. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadFlyers();
  }, [loadFlyers]);

  const filteredAndSortedFlyers = useMemo(() => {
    let result = [...flyers];

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((f) =>
        f.name.toLowerCase().includes(q) ||
        (f.description?.toLowerCase().includes(q) ?? false)
      );
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else if (sortBy === "date") {
        const aDate = a.createdAt instanceof Date ? a.createdAt.getTime() : 0;
        const bDate = b.createdAt instanceof Date ? b.createdAt.getTime() : 0;
        return bDate - aDate; // newest first
      } else if (sortBy === "usage") {
        return (campaignCounts[b.id] ?? 0) - (campaignCounts[a.id] ?? 0);
      }
      return 0;
    });

    return result;
  }, [flyers, searchQuery, sortBy, campaignCounts]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim()) return;
    setFeedback(null);
    setSaving(true);
    try {
      let fileUrl: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        fileUrl = await uploadFile(`users/${currentUser.id}/flyers/${Date.now()}.${ext}`, file);
      }
      const newFlyer: FlyerData = {
        name: name.trim(),
        description: description.trim() || undefined,
        fileUrl,
        createdAt: new Date(),
        createdBy: currentUser.id,
      };
      const id = await FlyerRepository.createFlyer(currentUser.id, newFlyer);
      setFlyers((previous) => [{ ...newFlyer, id }, ...previous]);
      setCampaignCounts((prev) => ({ ...prev, [id]: 0 }));
      setName("");
      setDescription("");
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFile(null);
      setFilePreview(null);
      setShowForm(false);
      setFeedback({ type: "success", message: "Flyer saved to your library." });
    } catch (err) {
      console.error("Failed to create flyer:", err);
      setFeedback({
        type: "error",
        message: "We couldn’t save this flyer. Your details and selected file are still here—please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (f: FlyerData & { id: string }) => {
    setEditingId(f.id);
    setEditName(f.name);
    setEditDescription(f.description || "");
    setEditFile(null);
    if (editFilePreview) URL.revokeObjectURL(editFilePreview);
    setEditFilePreview(null);
  };

  const cancelEdit = () => {
    if (editFilePreview) URL.revokeObjectURL(editFilePreview);
    setEditingId(null);
    setEditFile(null);
    setEditFilePreview(null);
  };

  const handleUpdate = async (flyerId: string) => {
    if (!currentUser || !editName.trim()) return;
    setFeedback(null);
    setEditSaving(true);
    try {
      const updates: Partial<Pick<FlyerData, "name" | "description" | "fileUrl">> = {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
      };
      if (editFile) {
        const ext = editFile.name.split(".").pop() || "jpg";
        updates.fileUrl = await uploadFile(`users/${currentUser.id}/flyers/${Date.now()}.${ext}`, editFile);
      }
      await FlyerRepository.updateFlyer(currentUser.id, flyerId, updates);
      setFlyers((previous) => previous.map((flyer) => (
        flyer.id === flyerId ? { ...flyer, ...updates } : flyer
      )));
      cancelEdit();
      setFeedback({ type: "success", message: "Flyer changes saved." });
    } catch (err) {
      console.error("Failed to update flyer:", err);
      setFeedback({
        type: "error",
        message: "We couldn’t save your changes. Your edits and selected file are still here—please try again.",
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (flyerId: string) => {
    if (!currentUser || !confirm("Remove this flyer from your library?")) return;
    setFeedback(null);
    setDeletingId(flyerId);
    try {
      await FlyerRepository.deleteFlyer(currentUser.id, flyerId);
      setFlyers((prev) => prev.filter((f) => f.id !== flyerId));
      setFeedback({ type: "success", message: "Flyer removed from your library." });
    } catch (err) {
      console.error("Failed to delete flyer:", err);
      setFeedback({ type: "error", message: "We couldn’t remove this flyer. Please try again." });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-gray-100">My Flyers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your flyer designs — reuse them across any campaign.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => {
              setFeedback(null);
              setShowForm(true);
            }}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            + Add Flyer
          </button>
        )}
      </div>

      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "error"
              ? "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"
              : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Search and sort controls (shown when library has flyers or form is not open) */}
      {flyers.length > 0 && !showForm && (
        <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
          <div className="flex-1">
            <label htmlFor="flyer-search" className="sr-only">
              Search flyers by name or description
            </label>
            <input
              id="flyer-search"
              type="text"
              placeholder="Search flyers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Search flyers"
            />
          </div>
          <div>
            <label htmlFor="sort-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-0 sm:sr-only">
              Sort by
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Sort flyers by"
            >
              <option value="date">Newest first</option>
              <option value="name">Name (A–Z)</option>
              <option value="usage">Most used</option>
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12" role="status" aria-label="Loading flyers">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900/60 dark:bg-red-950/20">
          <p className="font-medium text-red-900 dark:text-red-200">Unable to load flyers</p>
          <p className="mt-1 text-sm text-red-800 dark:text-red-300">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadFlyers()}
            className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-800"
          >
            Try again
          </button>
        </section>
      ) : (
        <>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 space-y-4 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Upload a new flyer</h2>

          <div>
            <label htmlFor="flyer-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Flyer name <span className="text-red-500" aria-label="required">*</span>
            </label>
            <input
              id="flyer-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale, Grand Opening..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-required="true"
            />
          </div>
          <div>
            <label htmlFor="flyer-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Notes <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <input
              id="flyer-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details about this flyer..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-describedby="description-hint"
            />
            <p id="description-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use this to remember the campaign or theme for this flyer
            </p>
          </div>
          <div>
            <label htmlFor="flyer-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Upload image
            </label>
            {filePreview && (
              <div className="mb-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">Preview:</p>
                <img
                  src={filePreview}
                  alt="Flyer preview"
                  className="max-w-xs h-40 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
              </div>
            )}
            <input
              id="flyer-image"
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (filePreview) URL.revokeObjectURL(filePreview);
                setFile(f);
                setFilePreview(f ? URL.createObjectURL(f) : null);
              }}
              className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 hover:file:bg-emerald-100"
              aria-describedby="image-hint"
            />
            <p id="image-hint" className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              JPG, PNG, or GIF. Max 10MB.
            </p>
          </div>
          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? "Uploading..." : "Save Flyer"}
            </button>
            <button
              type="button"
              onClick={() => {
                if (filePreview) URL.revokeObjectURL(filePreview);
                setShowForm(false);
                setFile(null);
                setFilePreview(null);
              }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {flyers.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">Build your flyer library</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-sm mx-auto">
            Upload your flyer designs once and reuse them across multiple campaigns. No more duplicate uploads.
          </p>
          <button
            onClick={() => {
              setFeedback(null);
              setShowForm(true);
            }}
            className="px-6 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            Upload your first flyer
          </button>
        </div>
      ) : filteredAndSortedFlyers.length === 0 && !showForm ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">No flyers match your search</h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
            Try adjusting your search terms or filters to find what you're looking for.
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear search
          </button>
        </div>
      ) : flyers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedFlyers.map((f) => (
            <div key={f.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow flex flex-col group">
              {editingId === f.id ? (
                <div className="p-4 space-y-3 flex-1">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flyer name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Change image</label>
                    {(editFilePreview || f.fileUrl) && (
                      <img
                        src={editFilePreview || f.fileUrl}
                        alt={f.name}
                        className="w-full h-32 object-cover rounded-lg mb-2 border border-gray-200 dark:border-gray-600"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const fl = e.target.files?.[0] ?? null;
                        if (editFilePreview) URL.revokeObjectURL(editFilePreview);
                        setEditFile(fl);
                        setEditFilePreview(fl ? URL.createObjectURL(fl) : null);
                      }}
                      className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 hover:file:bg-emerald-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpdate(f.id)}
                      disabled={editSaving || !editName.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {editSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Preview image */}
                  <div className="relative h-32 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 overflow-hidden group">
                    {f.fileUrl ? (
                      <img
                        src={f.fileUrl}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-4 flex-1 flex flex-col">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                      {f.name}
                    </h3>
                    {f.description && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2 flex-1">
                        {f.description}
                      </p>
                    )}

                    {/* Usage indicator */}
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 mb-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{campaignCounts[f.id] ?? 0} {(campaignCounts[f.id] ?? 0) === 1 ? "campaign" : "campaigns"}</span>
                      </div>

                      {/* Date created */}
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        Uploaded {f.createdAt instanceof Date ? f.createdAt.toLocaleDateString() : ""}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="px-4 pb-3 flex gap-1 border-t border-gray-200 dark:border-gray-700 pt-3">
                    <button
                      onClick={() => startEdit(f)}
                      className="flex-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 font-medium py-2 rounded transition-colors"
                      aria-label={`Edit ${f.name}`}
                    >
                      Edit
                    </button>
                    {!f.archivedAt && (
                      <button
                        onClick={() => navigate(`/app/setup?flyerId=${f.id}`)}
                        className="flex-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 font-medium py-2 rounded transition-colors"
                        aria-label={`Use ${f.name} in a campaign`}
                      >
                        Use
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deletingId === f.id}
                      className="flex-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 font-medium py-2 rounded transition-colors disabled:opacity-50"
                      aria-label={`Delete ${f.name}`}
                    >
                      {deletingId === f.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default FlyersPage;
