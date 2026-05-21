import React from "react";
import { Link, useLocation } from "react-router-dom";
import type { DoorData } from "../../models/door";
import type { PrintoutData } from "../../models/printout";

interface DoorListProps {
  campaignId: string;
  doorsByStreet: Record<string, {
    doors: (DoorData & { id: string })[];
    delivered: number;
    pending: number;
    reported: number;
  }>;
  expandedStreets: Set<string>;
  expandedDoorId: string | null;
  printouts: (PrintoutData & { id: string })[];
  canEditDoors: boolean;
  onToggleStreet: (street: string) => void;
  onToggleDoor: (doorId: string | null) => void;
  onDoorClick: (door: DoorData & { id: string }) => void;
  onDoorReport: (door: DoorData & { id: string }) => void;
  onDoorSelect?: (door: DoorData & { id: string }) => void;
}

const DoorList: React.FC<DoorListProps> = ({
  campaignId,
  doorsByStreet,
  expandedStreets,
  expandedDoorId,
  printouts,
  canEditDoors,
  onToggleStreet,
  onToggleDoor,
  onDoorClick,
  onDoorReport,
  onDoorSelect,
}) => {
  const location = useLocation();
  const routePrefix = location.pathname.startsWith("/walker") ? "/walker" : "/app";
  const totalDoors = Object.values(doorsByStreet).reduce((sum, street) => sum + street.doors.length, 0);

  if (totalDoors === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Doors (0)
        </h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No doors added yet.</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
        Doors ({totalDoors})
      </h2>
      <div className="lg:max-h-[360px] overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md divide-y divide-gray-100 dark:divide-gray-700">
        {Object.entries(doorsByStreet).map(([street, streetData]) => {
          const isStreetExpanded = expandedStreets.has(street);
          return (
            <div key={street}>
              <div
                onClick={() => onToggleStreet(street)}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 select-none"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{isStreetExpanded ? "\u25BE" : "\u25B8"}</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {street} ({streetData.doors.length})
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400">{streetData.delivered} delivered</span>
                  {streetData.pending > 0 && <span className="text-gray-500">{streetData.pending} pending</span>}
                  {streetData.reported > 0 && <span className="text-amber-500">{streetData.reported} reported</span>}
                </div>
              </div>
              {isStreetExpanded && streetData.doors.map((door) => (
                <div key={door.id}>
                  <div
                    onClick={() => {
                      onToggleDoor(expandedDoorId === door.id ? null : door.id);
                      if (onDoorSelect) onDoorSelect(door);
                    }}
                    className="flex items-center justify-between px-3 py-2 pl-6 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    <div className="flex items-center gap-2">
                      <Link
                        to={`${routePrefix}/campaign/${campaignId}/door/${door.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-gray-800 dark:text-gray-200 hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline"
                      >
                        {door.address}
                      </Link>
                      {(door.deliveryCount || 0) > 0 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {door.deliveryCount}x
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          door.status === "delivered"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                            : door.status === "reported"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                            : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {door.status}
                      </span>
                      {canEditDoors && door.status === "pending" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDoorReport(door);
                          }}
                          className="text-xs text-amber-500 hover:text-amber-600 dark:text-amber-400 dark:hover:text-amber-300"
                          title="Report issue"
                        >
                          Report
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleDoor(expandedDoorId === door.id ? null : door.id);
                        }}
                        className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {expandedDoorId === door.id ? "\u25B4" : "\u25BE"}
                      </button>
                    </div>
                  </div>
                  {/* Door details expansion */}
                  {expandedDoorId === door.id && (
                    <div className="pl-8 pr-3 pb-3 space-y-3 bg-gray-50 dark:bg-gray-800/30">
                      <div className="space-y-1 pt-2">
                        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          Door Details
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                          <div>Address: {door.address}</div>
                          <div>Status: {door.status}</div>
                          <div>Total deliveries: {door.deliveryCount || 0}</div>
                          {door.deliveredAt && (
                            <div>
                              Last delivered: {new Date(door.deliveredAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>

                      {door.history && door.history.length > 0 && (
                        <div className="space-y-1">
                          <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            Delivery History ({door.history.length})
                          </div>
                          {door.history.map((event, idx) => {
                            const eventDate = event.date instanceof Date ? event.date : new Date(event.date as any);
                            const printout = event.printoutVersionId
                              ? printouts.find((p) => p.id === event.printoutVersionId)
                              : null;
                            return (
                              <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400 py-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-1" />
                                <div className="flex-1">
                                  <div className="font-medium">{eventDate.toLocaleString()}</div>
                                  {printout && (
                                    <div className="text-gray-500 dark:text-gray-500">
                                      Version {printout.version}: {printout.name}
                                    </div>
                                  )}
                                  {event.notes && <div className="text-gray-500 dark:text-gray-500">{event.notes}</div>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {canEditDoors && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDoorClick(door);
                          }}
                          className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded"
                        >
                          {door.status === "delivered" ? "Mark as Pending" : "Mark as Delivered"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DoorList;
