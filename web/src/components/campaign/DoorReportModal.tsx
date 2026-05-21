import React, { useState } from "react";
import type { DoorData } from "../../models/door";
import type { PropertyReport, PropertyReportReason } from "../../models/property";
import { PropertyRepository } from "../../repositories/propertyRepository";
import { DoorRepository } from "../../repositories/doorRepository";

const REASON_OPTIONS: { value: PropertyReportReason; label: string }[] = [
  { value: "no_house", label: "No house at address" },
  { value: "construction", label: "Under construction" },
  { value: "angry_owner", label: "Angry owner" },
  { value: "no_junk_mail", label: "No junk mail sign" },
  { value: "other", label: "Other" },
];

type DoorReportModalProps = {
  campaignId: string;
  door: DoorData & { id: string };
  propertyId: string;
  reportedBy: string;
  onClose: () => void;
  onReported: (doorId: string) => void;
};

const DoorReportModal: React.FC<DoorReportModalProps> = ({
  campaignId,
  door,
  propertyId,
  reportedBy,
  onClose,
  onReported,
}) => {
  const [reason, setReason] = useState<PropertyReportReason>("no_junk_mail");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setPhoto(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } else {
      setPhotoPreview(null);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let photoUrl: string | undefined;
      if (photo) {
        photoUrl = await PropertyRepository.uploadPropertyPhoto(propertyId, photo);
      }

      const report: PropertyReport = {
        reason,
        photoUrl,
        notes: notes.trim() || undefined,
        reportedAt: new Date(),
        reportedBy,
        campaignId,
      };

      await PropertyRepository.addReport(propertyId, report);
      await DoorRepository.updateDoor(campaignId, door.id, { status: "reported" });
      onReported(door.id);
    } catch (err) {
      console.error("Failed to report door:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-5 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Report: {door.address}
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Reason</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as PropertyReportReason)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {REASON_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Photo (optional)</label>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-600 dark:text-gray-400"
          />
          {photoPreview && (
            <img src={photoPreview} alt="Preview" className="mt-2 rounded-md max-h-40 object-cover" />
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2 text-sm bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Report Door"}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default DoorReportModal;
