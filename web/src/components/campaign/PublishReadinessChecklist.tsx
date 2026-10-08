import React from "react";
import type { CampaignData } from "../../models/campaign";

export interface ChecklistItem {
  id: string;
  label: string;
  status: "complete" | "missing" | "recommended";
  value?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface PublishReadinessChecklistProps {
  campaignData: Partial<CampaignData>;
  totalDoors?: number;
  doorRadiusKm?: number;
}

const PublishReadinessChecklist: React.FC<PublishReadinessChecklistProps> = ({
  campaignData,
  totalDoors = 0,
  doorRadiusKm = 0,
}) => {
  // Determine status of each field
  const hasLocation = Boolean(campaignData.suburb && campaignData.postcode && campaignData.state);
  const hasDeliveryArea = Boolean(campaignData.doorRadiusM && campaignData.doorRadiusM > 0);
  const hasFlyer = Boolean(campaignData.activePrintoutId);
  const hasDoors = totalDoors > 0;
  const hasBudget = Boolean(campaignData.budget && campaignData.budget > 0);
  const hasDueDate = Boolean(campaignData.dueDate);

  const items: ChecklistItem[] = [
    {
      id: "location",
      label: "Location",
      status: hasLocation ? "complete" : "missing",
      value: hasLocation ? `${campaignData.suburb} ${campaignData.postcode}` : undefined,
    },
    {
      id: "delivery-area",
      label: "Delivery Area",
      status: hasDeliveryArea ? "complete" : "missing",
      value: hasDeliveryArea ? `${doorRadiusKm} km radius` : undefined,
    },
    {
      id: "flyer",
      label: "Active Flyer",
      status: hasFlyer ? "complete" : "missing",
      value: hasFlyer ? "Selected" : undefined,
    },
    {
      id: "doors",
      label: "Delivery Locations",
      status: hasDoors ? "complete" : "missing",
      value: hasDoors ? `${totalDoors} ${totalDoors === 1 ? "location" : "locations"}` : undefined,
    },
    {
      id: "budget",
      label: "Budget",
      status: hasBudget ? "complete" : "recommended",
      value: hasBudget ? `$${campaignData.budget?.toLocaleString()}` : undefined,
    },
    {
      id: "due-date",
      label: "Due Date",
      status: hasDueDate ? "complete" : "recommended",
      value: hasDueDate
        ? (campaignData.dueDate instanceof Date ? campaignData.dueDate : new Date(campaignData.dueDate!)).toLocaleDateString()
        : undefined,
    },
  ];

  const requiredItems = items.filter((i) => i.status !== "recommended");
  const allRequiredComplete = requiredItems.every((i) => i.status === "complete");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
              item.status === "complete"
                ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/60"
                : item.status === "missing"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/60"
                  : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/60"
            }`}
          >
            <div className="flex-shrink-0 mt-0.5">
              {item.status === "complete" ? (
                <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : item.status === "missing" ? (
                <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <p
                  className={`text-sm font-medium ${
                    item.status === "complete"
                      ? "text-emerald-900 dark:text-emerald-100"
                      : item.status === "missing"
                        ? "text-red-900 dark:text-red-100"
                        : "text-amber-900 dark:text-amber-100"
                  }`}
                >
                  {item.label}
                </p>
                {item.status === "missing" && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                    Required
                  </span>
                )}
                {item.status === "recommended" && !item.value && (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                    Recommended
                  </span>
                )}
              </div>
              {item.value && (
                <p
                  className={`text-sm ${
                    item.status === "complete"
                      ? "text-emerald-800 dark:text-emerald-200"
                      : item.status === "missing"
                        ? "text-red-800 dark:text-red-200"
                        : "text-amber-800 dark:text-amber-200"
                  }`}
                >
                  {item.value}
                </p>
              )}
              {item.status === "missing" && item.actionLabel && item.onAction && (
                <button
                  type="button"
                  onClick={item.onAction}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline font-medium mt-1"
                >
                  {item.actionLabel} →
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Progress indicator */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Publish readiness</span>
          <span
            className={`text-xs font-semibold ${
              allRequiredComplete
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {requiredItems.filter((i) => i.status === "complete").length}/{requiredItems.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              allRequiredComplete
                ? "bg-emerald-600"
                : "bg-red-600"
            }`}
            style={{
              width: `${(requiredItems.filter((i) => i.status === "complete").length / requiredItems.length) * 100}%`,
            }}
          />
        </div>
      </div>

      {!allRequiredComplete && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/60 rounded-lg p-3">
          <p className="text-sm text-red-900 dark:text-red-200">
            <strong>Cannot publish yet.</strong> Please complete all required fields above before publishing.
          </p>
        </div>
      )}

      {allRequiredComplete && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/60 rounded-lg p-3">
          <p className="text-sm text-emerald-900 dark:text-emerald-200">
            <strong>Ready to publish!</strong> Your campaign has all required information. Walkers will see it once you publish.
          </p>
        </div>
      )}
    </div>
  );
};

export default PublishReadinessChecklist;
