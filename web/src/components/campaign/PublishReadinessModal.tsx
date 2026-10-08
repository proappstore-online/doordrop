import React from "react";
import PublishReadinessChecklist from "./PublishReadinessChecklist";
import type { CampaignData } from "../../models/campaign";

interface PublishReadinessModalProps {
  campaignData: Partial<CampaignData>;
  totalDoors?: number;
  doorRadiusKm?: number;
  isOpen: boolean;
  isPublishing?: boolean;
  onPublish: () => void;
  onSaveDraft: () => void;
  onClose: () => void;
}

const PublishReadinessModal: React.FC<PublishReadinessModalProps> = ({
  campaignData,
  totalDoors = 0,
  doorRadiusKm = 0,
  isOpen,
  isPublishing = false,
  onPublish,
  onSaveDraft,
  onClose,
}) => {
  if (!isOpen) return null;

  // Check if all required fields are complete
  const hasLocation = Boolean(campaignData.suburb && campaignData.postcode && campaignData.state);
  const hasDeliveryArea = Boolean(campaignData.doorRadiusM && campaignData.doorRadiusM > 0);
  const hasFlyer = Boolean(campaignData.activePrintoutId);
  const hasDoors = totalDoors > 0;

  const isReadyToPublish = hasLocation && hasDeliveryArea && hasFlyer && hasDoors;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Review & Publish</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Make sure everything is ready before publishing
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isPublishing}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Campaign Summary */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Campaign Summary</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Location</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {campaignData.suburb && campaignData.postcode
                    ? `${campaignData.suburb} ${campaignData.postcode}`
                    : "Not set"}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Delivery Radius</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {doorRadiusKm ? `${doorRadiusKm} km` : "Not set"}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Delivery Locations</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {totalDoors} {totalDoors === 1 ? "location" : "locations"}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Active Flyer</p>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {campaignData.activePrintoutId ? "Selected" : "Not set"}
                </p>
              </div>
            </div>
          </div>

          {/* Publish Readiness Checklist */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Publish Readiness</h3>
            <PublishReadinessChecklist
              campaignData={campaignData}
              totalDoors={totalDoors}
              doorRadiusKm={doorRadiusKm}
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>What happens when you publish?</strong> Your campaign becomes visible to walkers. They can express interest and you can assign one to deliver the flyers. Changes can still be made to draft campaigns.
            </p>
          </div>
        </div>

        {/* Footer with actions */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-6 flex gap-3 justify-between">
          <button
            type="button"
            onClick={onSaveDraft}
            disabled={isPublishing}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium transition-colors disabled:opacity-50"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={onPublish}
            disabled={!isReadyToPublish || isPublishing}
            aria-label={
              !isReadyToPublish
                ? "Cannot publish: complete all required fields"
                : "Publish campaign"
            }
            title={
              !isReadyToPublish
                ? "Complete all required fields to publish"
                : "Publish campaign to walkers"
            }
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              isReadyToPublish
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
            }`}
          >
            {isPublishing ? "Publishing..." : "Publish Campaign"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublishReadinessModal;
