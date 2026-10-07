import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { DoorRepository } from "../../repositories/doorRepository";
import { PrintoutRepository } from "../../repositories/printoutRepository";
import { PropertyRepository } from "../../repositories/propertyRepository";
import type { DoorData } from "../../models/door";
import type { PropertyReport, PropertyReportReason } from "../../models/property";
import type { PrintoutData } from "../../models/printout";

const REASON_LABELS: Record<PropertyReportReason, string> = {
  no_house: "No house at address",
  construction: "Under construction",
  angry_owner: "Angry owner",
  no_junk_mail: "No junk mail sign",
  other: "Other",
};

const statusBadgeClass = (status: string) => {
  switch (status) {
    case "delivered":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
    case "reported":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400";
  }
};

const DoorDetailPage: React.FC = () => {
  const { campaignId, doorId } = useParams<{ campaignId: string; doorId: string }>();
  const location = useLocation();

  const [door, setDoor] = useState<(DoorData & { id: string }) | null>(null);
  const [printouts, setPrintouts] = useState<(PrintoutData & { id: string })[]>([]);
  const [propertyReports, setPropertyReports] = useState<(PropertyReport & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);

  const backPath = location.pathname.startsWith("/walker")
    ? `/walker/campaign/${campaignId}`
    : `/app/campaign/${campaignId}`;

  // TODO(task #10): replace 5s polling with a fas.rooms subscription.
  useEffect(() => {
    if (!campaignId || !doorId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const doors = await DoorRepository.getDoorsByCampaign(campaignId);
        if (!cancelled) setDoor(doors.find((d) => d.id === doorId) ?? null);
      } catch (err) {
        console.error("Failed to load door:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [campaignId, doorId]);

  // Load printouts
  useEffect(() => {
    if (!campaignId) return;
    PrintoutRepository.getVersions(campaignId).then(setPrintouts);
  }, [campaignId]);

  // Load property reports when door loads
  useEffect(() => {
    if (!door?.propertyId) {
      setPropertyReports([]);
      return;
    }
    PropertyRepository.getReports(door.propertyId)
      .then(setPropertyReports)
      .catch((err) => console.error("Failed to load property reports:", err));
  }, [door?.propertyId]);

  const hasCoords = door?.lat != null && door?.lng != null;

  const reportFlags = useMemo(() => {
    if (propertyReports.length === 0) return [];
    const reasons = new Set(propertyReports.map((r) => r.reason));
    return Array.from(reasons).map((r) => REASON_LABELS[r] || r);
  }, [propertyReports]);

  const sortedHistory = useMemo(() => {
    if (!door?.history) return [];
    return [...door.history].sort((a, b) => {
      const da = a.date instanceof Date ? a.date : new Date(a.date as any);
      const db = b.date instanceof Date ? b.date : new Date(b.date as any);
      return db.getTime() - da.getTime();
    });
  }, [door?.history]);

  const sortedReports = useMemo(() => {
    if (propertyReports.length === 0) return [];
    return [...propertyReports].sort((a, b) => {
      const da = a.reportedAt instanceof Date ? a.reportedAt : new Date(a.reportedAt as any);
      const db = b.reportedAt instanceof Date ? b.reportedAt : new Date(b.reportedAt as any);
      return db.getTime() - da.getTime();
    });
  }, [propertyReports]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!door) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to={backPath} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Back to campaign
        </Link>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Door not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Back link */}
      <Link to={backPath} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        &larr; Back to campaign
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{door.houseNumber}</span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{door.address}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{door.streetName}</p>
          </div>
          <span className={`ml-auto text-xs font-medium px-2.5 py-1 rounded-full ${statusBadgeClass(door.status)}`}>
            {door.status}
          </span>
        </div>
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
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

      {/* Info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Status</div>
          <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 ${statusBadgeClass(door.status)}`}>
            {door.status}
          </span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Deliveries</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">{door.deliveryCount || 0}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Last Delivered</div>
          <div className="text-sm font-medium text-gray-900 dark:text-gray-100 mt-1">
            {door.deliveredAt ? new Date(door.deliveredAt as any).toLocaleDateString() : "\u2014"}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
          <div className="text-xs text-gray-500 dark:text-gray-400">Report Flags</div>
          <div className="mt-1">
            {reportFlags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {reportFlags.map((flag) => (
                  <span key={flag} className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-1.5 py-0.5 rounded">
                    {flag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-400">None</span>
            )}
          </div>
        </div>
      </div>

      {/* Delivery History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Delivery History ({sortedHistory.length})
          </h2>
        </div>
        {sortedHistory.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {sortedHistory.map((event, idx) => {
              const eventDate = event.date instanceof Date ? event.date : new Date(event.date as any);
              const printout = event.printoutVersionId
                ? printouts.find((p) => p.id === event.printoutVersionId)
                : null;
              return (
                <div key={idx} className="px-4 py-3 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {eventDate.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Delivered by: {event.deliveredBy}
                    </div>
                    {printout && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Version {printout.version}: {printout.name}
                      </div>
                    )}
                    {event.notes && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{event.notes}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No deliveries yet
          </div>
        )}
      </div>

      {/* Reports */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Reports ({sortedReports.length})
          </h2>
        </div>
        {sortedReports.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {sortedReports.map((report, idx) => {
              const reportDate = report.reportedAt instanceof Date ? report.reportedAt : new Date(report.reportedAt as any);
              return (
                <div key={idx} className="px-4 py-3 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {reportDate.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Reason: {REASON_LABELS[report.reason] || report.reason}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Reported by: {report.reportedBy}
                    </div>
                    {report.notes && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{report.notes}</div>
                    )}
                    {report.photoUrl && (
                      <a
                        href={report.photoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline mt-1 inline-block"
                      >
                        View photo
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-gray-400 dark:text-gray-500">
            No reports
          </div>
        )}
      </div>
    </div>
  );
};

export default DoorDetailPage;
