import React, { useEffect, useState } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { FlyerRepository } from "../../repositories/flyerRepository";
import type { FlyerData } from "../../models/flyer";
import { uploadFile } from "../../utils/storageUpload";

const FlyersPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const [flyers, setFlyers] = useState<(FlyerData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setLoading(true);
      try {
        const data = await FlyerRepository.getFlyers(currentUser.id);
        setFlyers(data);
      } catch (err) {
        console.error("Failed to load flyers:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !name.trim()) return;
    setSaving(true);
    try {
      let fileUrl: string | undefined;
      if (file) {
        const ext = file.name.split(".").pop() || "jpg";
        fileUrl = await uploadFile(`users/${currentUser.id}/flyers/${Date.now()}.${ext}`, file);
      }
      await FlyerRepository.createFlyer(currentUser.id, {
        name: name.trim(),
        description: description.trim() || undefined,
        fileUrl,
        createdAt: new Date(),
        createdBy: currentUser.id,
      });
      setFlyers(await FlyerRepository.getFlyers(currentUser.id));
      setName("");
      setDescription("");
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFile(null);
      setFilePreview(null);
      setShowForm(false);
    } catch (err) {
      console.error("Failed to create flyer:", err);
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
    if (!currentUser) return;
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
      setFlyers(await FlyerRepository.getFlyers(currentUser.id));
      cancelEdit();
    } catch (err) {
      console.error("Failed to update flyer:", err);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (flyerId: string) => {
    if (!currentUser || !confirm("Remove this flyer from your library?")) return;
    setDeletingId(flyerId);
    try {
      await FlyerRepository.deleteFlyer(currentUser.id, flyerId);
      setFlyers((prev) => prev.filter((f) => f.id !== flyerId));
    } catch (err) {
      console.error("Failed to delete flyer:", err);
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">My Flyers</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Your flyer designs — reuse them across any campaign.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            + Add Flyer
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Flyer name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Summer Sale, Grand Opening..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Any details about this flyer..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload image</label>
            {filePreview && (
              <img src={filePreview} alt="Preview" className="w-40 h-40 object-cover rounded-lg mb-2 border border-gray-200 dark:border-gray-600" />
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (filePreview) URL.revokeObjectURL(filePreview);
                setFile(f);
                setFilePreview(f ? URL.createObjectURL(f) : null);
              }}
              className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 hover:file:bg-emerald-100"
            />
          </div>
          <div className="flex gap-2 pt-1">
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
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-900 dark:text-gray-100 font-medium mb-1">No flyers yet</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            Upload your flyer designs here and use them in any campaign.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            Upload your first flyer
          </button>
        </div>
      ) : flyers.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {flyers.map((f) => (
            <div key={f.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden group">
              {editingId === f.id ? (
                <div className="p-4 space-y-3">
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
                        className="w-full h-40 object-cover rounded-lg mb-2 border border-gray-200 dark:border-gray-600"
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
                  {f.fileUrl ? (
                    <img
                      src={f.fileUrl}
                      alt={f.name}
                      className="w-full h-44 object-cover"
                    />
                  ) : (
                    <div className="w-full h-44 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <svg className="w-10 h-10 text-gray-300 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {f.name}
                    </h3>
                    {f.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{f.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-xs text-gray-400">
                        {f.createdAt instanceof Date ? f.createdAt.toLocaleDateString() : ""}
                      </span>
                      <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => startEdit(f)}
                          className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(f.id)}
                          disabled={deletingId === f.id}
                          className="text-xs text-red-500 hover:underline font-medium disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FlyersPage;
