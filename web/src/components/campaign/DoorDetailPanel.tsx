import React, { useMemo } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import type { DoorData } from "../../models/door";
import type { PropertyReport } from "../../models/property";
import type { PrintoutData } from "../../models/printout";

interface DoorDetailPanelProps {
  door: DoorData & { id: string };
  printouts: (PrintoutData & { id: string })[];
  propertyReports?: (PropertyReport & { id: string })[];
  canEditDoors: boolean;
  onDoorClick: (door: DoorData & { id: string }) => void;
  onClose: () => void;
}

type TimelineEntry = {
  date: Date;
  type: "delivery" | "report";
  label: string;
  notes?: string;
  photoUrl?: string;
};

const DoorDetailPanel: React.FC<DoorDetailPanelProps> = ({
  door,
  printouts,
  propertyReports,
  canEditDoors,
  onDoorClick,
  onClose,
}) => {
  const hasCoords = door.lat != null && door.lng != null;

  const timeline = useMemo(() => {
    const entries: TimelineEntry[] = [];

    if (door.history) {
      for (const event of door.history) {
        const date = event.date instanceof Date ? event.date : new Date(event.date as any);
        const printout = event.printoutVersionId
          ? printouts.find((p) => p.id === event.printoutVersionId)
          : null;
        entries.push({
          date,
          type: "delivery",
          label: printout ? `Version ${printout.version}: ${printout.name}` : "Delivery",
          notes: event.notes,
        });
      }
    }

    if (propertyReports) {
      for (const report of propertyReports) {
        const date = report.reportedAt instanceof Date ? report.reportedAt : new Date(report.reportedAt as any);
        entries.push({
          date,
          type: "report",
          label: report.reason,
          notes: report.notes,
          photoUrl: report.photoUrl,
        });
      }
    }

    entries.sort((a, b) => b.date.getTime() - a.date.getTime());
    return entries;
  }, [door.history, propertyReports, printouts]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full sm:w-96 z-50 bg-white dark:bg-gray-900 shadow-xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {door.address}
            </h2>
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${
                door.status === "delivered"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                  : door.status === "reported"
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
              }`}
            >
              {door.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="ml-3 p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Mini Map */}
          {hasCoords && (
            <div className="h-[200px]">
              <MapContainer
                center={[door.lat!, door.lng!]}
                zoom={18}
                scrollWheelZoom={false}
                dragging={false}
                zoomControl={false}
                attributionControl={false}
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[door.lat!, door.lng!]} />
              </MapContainer>
            </div>
          )}

          {/* Summary */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/50 space-y-1">
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total deliveries: <span className="font-medium text-gray-700 dark:text-gray-300">{door.deliveryCount || 0}</span>
            </div>
            {door.deliveredAt && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Last delivered: <span className="font-medium text-gray-700 dark:text-gray-300">{new Date(door.deliveredAt as any).toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Timeline */}
          {timeline.length > 0 && (
            <div className="px-4 py-3 space-y-3">
              <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                History ({timeline.length})
              </div>
              {timeline.map((entry, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs py-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${
                      entry.type === "delivery" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-700 dark:text-gray-300">
                      {entry.date.toLocaleString()}
                    </div>
                    <div className="text-gray-500 dark:text-gray-400">{entry.label}</div>
                    {entry.notes && (
                      <div className="text-gray-400 dark:text-gray-500">{entry.notes}</div>
                    )}
                    {entry.photoUrl && (
                      <a
                        href={entry.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                      >
                        View photo
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {timeline.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              No history yet
            </div>
          )}
        </div>

        {/* Action Button */}
        {canEditDoors && door.status !== "reported" && (
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => onDoorClick(door)}
              className={`w-full text-sm px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                door.status === "delivered"
                  ? "bg-gray-600 hover:bg-gray-700"
                  : "bg-emerald-600 hover:bg-emerald-700"
              }`}
            >
              {door.status === "delivered" ? "Mark as Pending" : "Mark as Delivered"}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default DoorDetailPanel;
