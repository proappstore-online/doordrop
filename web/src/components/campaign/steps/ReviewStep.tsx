import React from "react";
import type { CampaignData } from "../../../models/campaign";

interface ReviewStepProps {
  data: Partial<CampaignData>;
}

interface ChecklistItem {
  label: string;
  value?: string | number;
  isValid: boolean;
}

const ReviewStep: React.FC<ReviewStepProps> = ({ data }) => {
  const checklist: ChecklistItem[] = [
    {
      label: "Location",
      value: data.suburb && data.postcode ? `${data.suburb} ${data.postcode}` : undefined,
      isValid: Boolean(data.suburb && data.postcode && data.state),
    },
    {
      label: "Delivery radius",
      value: data.doorRadiusM ? `${Math.round(data.doorRadiusM / 1000)} km` : undefined,
      isValid: Boolean(data.doorRadiusM && data.doorRadiusM > 0),
    },
    {
      label: "Flyer",
      value: data.activePrintoutId ? "Selected" : undefined,
      isValid: Boolean(data.activePrintoutId),
    },
    {
      label: "Start date",
      value: data.dueDate
        ? new Date(data.dueDate).toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : undefined,
      isValid: Boolean(data.dueDate),
    },
    {
      label: "Budget",
      value: data.budget !== undefined ? `$${data.budget.toLocaleString()}` : undefined,
      isValid: data.budget !== undefined && data.budget > 0,
    },
  ];

  const allValid = checklist.every((item) => item.isValid);
  const completedCount = checklist.filter((item) => item.isValid).length;

  return (
    <fieldset className="space-y-6">
      <legend className="sr-only">Campaign review and publish</legend>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Campaign Summary</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Review your campaign details below. Make sure everything is correct before publishing.
        </p>
      </div>

      {/* Publish readiness checklist */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-3">Publish readiness</h3>
        <div className="space-y-2">
          {checklist.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-2 rounded transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="mt-0.5 flex-shrink-0">
                {item.isValid ? (
                  <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-gray-300 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-medium ${item.isValid ? "text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                  {item.label}
                </p>
                {item.value && (
                  <p className={`text-sm ${item.isValid ? "text-gray-600 dark:text-gray-400" : "text-gray-400 dark:text-gray-500"}`}>
                    {item.value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress indicator */}
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Progress</span>
            <span className={`text-sm font-semibold ${allValid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
              {completedCount}/{checklist.length}
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${allValid ? "bg-emerald-600" : "bg-amber-600"}`}
              style={{ width: `${(completedCount / checklist.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status message */}
      {allValid ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/20">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Ready to publish</p>
              <p className="text-sm text-emerald-800 dark:text-emerald-200 mt-1">
                Your campaign is ready. Click "Publish" to make it available to walkers.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-900/20">
          <div className="flex gap-3">
            <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Not ready yet</p>
              <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
                Please complete all required fields ({completedCount}/{checklist.length} complete) before publishing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-900/20">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Save as draft?</strong> You can save this campaign as a draft and come back to finish it later. Drafts are automatically saved as you make changes.
        </p>
      </div>
    </fieldset>
  );
};

export default ReviewStep;
