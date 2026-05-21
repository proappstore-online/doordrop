import React from "react";
import DebugPanel from "../DebugPanel";
import type { DoorData } from "../../models/door";
import type { TrackingDebugInfo } from "../../types/trackingDebug";

interface DeliveryTrackingPanelProps {
  trackingState: "idle" | "requesting" | "active" | "out_of_range" | "left_area" | "error";
  doorRadiusM: number;
  junkMailPolicy?: "deliver" | "skip";
  propertyFilter?: "all" | "residential" | "commercial";
  geoError: string | null;
  walkerPosition: { lat: number; lng: number } | null;
  elapsedMinutes: number;
  distanceKm: number;
  debugInfo: TrackingDebugInfo;
  isAdmin: boolean;
  doors: (DoorData & { id: string })[];
  campaignId: string | undefined;
  currentUserId: string | undefined;
  onStartTracking: (doors: (DoorData & { id: string })[], campaignId: string | undefined, userId: string | undefined, radius: number, callback: (doorId: string) => Promise<void>) => void;
  onStopTracking: () => void;
  onDismissError: () => void;
  onDoorVisited: (doorId: string) => Promise<void>;
}

const DeliveryTrackingPanel: React.FC<DeliveryTrackingPanelProps> = ({
  trackingState,
  doorRadiusM,
  junkMailPolicy,
  propertyFilter,
  geoError,
  walkerPosition,
  elapsedMinutes,
  distanceKm,
  debugInfo,
  isAdmin,
  doors,
  campaignId,
  currentUserId,
  onStartTracking,
  onStopTracking,
  onDismissError,
  onDoorVisited,
}) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-3">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Delivery Tracking</h2>

      {trackingState === "idle" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Start tracking to enable automatic door delivery. Doors will be marked as delivered when you're within the geofence radius.
          </p>

          {/* Geofence Radius Info */}
          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Auto-Delivery Radius
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {doorRadiusM}m
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-300">
              Doors are automatically marked as delivered when you're within {doorRadiusM} meters
            </p>
          </div>

          {/* Show delivery settings to walker */}
          {(junkMailPolicy || propertyFilter) && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded p-2 space-y-0.5">
              {junkMailPolicy === "skip" && <p>• Skip doors with "No Junk Mail" signs</p>}
              {propertyFilter && propertyFilter !== "all" && (
                <p>• Deliver to {propertyFilter} properties only</p>
              )}
            </div>
          )}
          <button
            onClick={() => onStartTracking(doors, campaignId, currentUserId, doorRadiusM, onDoorVisited)}
            className="w-full px-4 py-2 text-sm bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
          >
            Start Tracking
          </button>
        </div>
      )}

      {trackingState === "requesting" && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Requesting location...
        </div>
      )}

      {trackingState === "out_of_range" && (
        <div className="space-y-2">
          <p className="text-sm text-red-600 dark:text-red-400">
            You're not near any doors. Move closer to a delivery door and try again.
          </p>
          <button
            onClick={onDismissError}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {trackingState === "left_area" && (
        <div className="space-y-2">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Tracking stopped automatically — you moved away from all doors for 30 seconds.
          </p>
          <button
            onClick={onDismissError}
            className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Debug Panel */}
      {isAdmin && (
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <DebugPanel data={debugInfo} title="Tracking Debug Info" />
        </div>
      )}

      {geoError && trackingState !== "out_of_range" && !walkerPosition && (
        <p className="text-sm text-amber-600 dark:text-amber-400">
          {geoError} (Trying to reconnect...)
        </p>
      )}

      {trackingState === "active" && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Time</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {Math.floor(elapsedMinutes)}:{String(Math.floor((elapsedMinutes % 1) * 60)).padStart(2, "0")}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Distance</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {distanceKm.toFixed(2)} km
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-emerald-600 dark:text-emerald-400">Tracking</span>
            </div>
          </div>
          <button
            onClick={onStopTracking}
            className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Stop Tracking
          </button>
        </div>
      )}
    </div>
  );
};

export default DeliveryTrackingPanel;
