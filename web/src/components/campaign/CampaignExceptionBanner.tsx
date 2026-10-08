import React from "react";
import type { CampaignData } from "../../models/campaign";

interface CampaignExceptionBannerProps {
  campaign: Partial<CampaignData>;
  totalDoors: number;
  dismissedExceptions: Set<string>;
  onDismiss: (id: string) => void;
}

interface ExceptionState {
  id: string;
  severity: "error" | "warning" | "info";
  title: string;
  message: string;
  icon: string;
}

const CampaignExceptionBanner: React.FC<CampaignExceptionBannerProps> = ({
  campaign,
  totalDoors,
  dismissedExceptions,
  onDismiss,
}) => {
  const exceptions: ExceptionState[] = [];

  // Check for blocking conditions based on status
  if (campaign.status === "draft") {
    if (!campaign.activePrintoutId) {
      exceptions.push({
        id: "no-flyer",
        severity: "error",
        title: "No flyer selected",
        message: "Walkers won't know what to deliver. Select an active flyer before publishing.",
        icon: "⚠️",
      });
    }
    if (!campaign.doorRadiusM || campaign.doorRadiusM <= 0) {
      exceptions.push({
        id: "no-radius",
        severity: "error",
        title: "No delivery area set",
        message: "Set a delivery radius to define where walkers can operate.",
        icon: "⚠️",
      });
    }
    if (totalDoors === 0) {
      exceptions.push({
        id: "no-doors",
        severity: "error",
        title: "No delivery locations selected",
        message: "Add at least one address where flyers should be delivered.",
        icon: "⚠️",
      });
    }
    if (!campaign.suburb || !campaign.postcode || !campaign.state) {
      exceptions.push({
        id: "incomplete-location",
        severity: "error",
        title: "Location incomplete",
        message: "Specify suburb, postcode, and state for this campaign.",
        icon: "⚠️",
      });
    }
  }

  if (campaign.status === "ready" && !campaign.assignedWalkerId) {
    exceptions.push({
      id: "no-walker",
      severity: "warning",
      title: "No walker assigned",
      message: "Assign a walker to this campaign before it can begin.",
      icon: "👤",
    });
  }

  if (campaign.status === "assigned" && !campaign.jobStatus?.includes("in_progress")) {
    exceptions.push({
      id: "not-started",
      severity: "info",
      title: "Delivery not started",
      message: "The assigned walker hasn't begun delivery tracking yet.",
      icon: "🚶",
    });
  }

  const visibleExceptions = exceptions.filter((e) => !dismissedExceptions.has(e.id));

  if (visibleExceptions.length === 0) return null;

  return (
    <div className="space-y-3">
      {visibleExceptions.map((exception) => (
        <div
          key={exception.id}
          role="alert"
          className={`rounded-lg border p-4 flex gap-3 ${
            exception.severity === "error"
              ? "border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20"
              : exception.severity === "warning"
                ? "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20"
                : "border-blue-200 bg-blue-50 dark:border-blue-900/60 dark:bg-blue-950/20"
          }`}
        >
          <span className="flex-shrink-0 text-xl">{exception.icon}</span>
          <div className="flex-1">
            <p
              className={`text-sm font-semibold ${
                exception.severity === "error"
                  ? "text-red-900 dark:text-red-100"
                  : exception.severity === "warning"
                    ? "text-amber-900 dark:text-amber-100"
                    : "text-blue-900 dark:text-blue-100"
              }`}
            >
              {exception.title}
            </p>
            <p
              className={`text-sm mt-1 ${
                exception.severity === "error"
                  ? "text-red-800 dark:text-red-200"
                  : exception.severity === "warning"
                    ? "text-amber-800 dark:text-amber-200"
                    : "text-blue-800 dark:text-blue-200"
              }`}
            >
              {exception.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(exception.id)}
            className={`flex-shrink-0 font-bold ${
              exception.severity === "error"
                ? "text-red-600 hover:text-red-800 dark:text-red-400"
                : exception.severity === "warning"
                  ? "text-amber-600 hover:text-amber-800 dark:text-amber-400"
                  : "text-blue-600 hover:text-blue-800 dark:text-blue-400"
            }`}
            aria-label="Dismiss notice"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default CampaignExceptionBanner;
