import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { useAuthContext } from "../../hooks/useAuthContext";
import { PropertyRepository } from "../../repositories/propertyRepository";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { PrintoutRepository } from "../../repositories/printoutRepository";
import type { PropertyData, PropertyReport, PropertyReportReason } from "../../models/property";
import type { DeliveryEvent } from "../../models/door";
import type { PrintoutData } from "../../models/printout";

const REASON_LABELS: Record<PropertyReportReason, string> = {
  no_house: "No house at address",
  construction: "Under construction",
  angry_owner: "Angry owner",
  no_junk_mail: "No junk mail sign",
  other: "Other",
};

type DeliveryHistoryEntry = DeliveryEvent & {
  campaignName: string;
  campaignId: string;
  printoutName?: string;
};

const PropertyDetailPage: React.FC = () => {
  const { propertyId } = useParams<{ propertyId: string }>();
  const { currentUser } = useAuthContext();

  const [property, setProperty] = useState<(PropertyData & { id: string }) | null>(null);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistoryEntry[]>([]);
  const [propertyReports, setPropertyReports] = useState<(PropertyReport & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Load property
  useEffect(() => {
    if (!propertyId) return;
    PropertyRepository.getProperty(propertyId)
      .then(setProperty)
      .catch((err) => console.error("Failed to load property:", err))
      .finally(() => setLoading(false));
  }, [propertyId]);

  // Load property reports
  useEffect(() => {
    if (!propertyId) return;
    PropertyRepository.getReports(propertyId)
      .then(setPropertyReports)
      .catch((err) => console.error("Failed to load property reports:", err))
      .finally(() => setReportsLoading(false));
  }, [propertyId]);

  // Load delivery history across campaigns
  useEffect(() => {
    if (!currentUser || !property) return;

    const loadHistory = async () => {
      setHistoryLoading(true);
      try {
        const campaigns = await CampaignRepository.getCampaignsByUser(currentUser.id);
        const entries: DeliveryHistoryEntry[] = [];

        for (const campaign of campaigns) {
          const doors = await DoorRepository.getDoorsByCampaign(campaign.id);
          // Match doors by address
          const matched = doors.filter(
            (d) => d.address === property.address && d.streetName === property.streetName
          );

          if (matched.length === 0) continue;

          // Load printouts for this campaign once
          let printouts: (PrintoutData & { id: string })[] = [];
          const hasHistory = matched.some((d) => d.history && d.history.length > 0);
          if (hasHistory) {
            printouts = await PrintoutRepository.getVersions(campaign.id);
          }

          for (const door of matched) {
            if (!door.history) continue;
            for (const event of door.history) {
              const printout = event.printoutVersionId
                ? printouts.find((p) => p.id === event.printoutVersionId)
                : null;
              entries.push({
                ...event,
                campaignName: campaign.name,
                campaignId: campaign.id,
                printoutName: printout ? `v${printout.version}: ${printout.name}` : undefined,
              });
            }
          }
        }

        // Sort newest first
        entries.sort((a, b) => {
          const da = a.date instanceof Date ? a.date : new Date(a.date as any);
          const db = b.date instanceof Date ? b.date : new Date(b.date as any);
          return db.getTime() - da.getTime();
        });

        setDeliveryHistory(entries);
      } catch (err) {
        console.error("Failed to load delivery history:", err);
      } finally {
        setHistoryLoading(false);
      }
    };

    loadHistory();
  }, [currentUser, property]);

  const hasCoords = property?.lat != null && property?.lng != null;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <Link to="/app/properties" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Back to addresses
        </Link>
        <p className="text-gray-600 dark:text-gray-400 mt-4">Property not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      {/* Back link */}
      <Link to="/app/properties" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        &larr; Back to addresses
      </Link>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3">
          <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{property.houseNumber}</span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{property.address}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {property.streetName}, {property.suburb} {property.postcode}
            </p>
          </div>
        </div>
      </div>

      {/* Map */}
      {hasCoords && (
        <div className="h-[300px] rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
          <MapContainer
            center={[property.lat!, property.lng!]}
            zoom={18}
            scrollWheelZoom={false}
            dragging={false}
            zoomControl={false}
            attributionControl={false}
            className="h-full w-full"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <Marker position={[property.lat!, property.lng!]} />
          </MapContainer>
        </div>
      )}

      {/* Delivery History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Delivery History {!historyLoading && `(${deliveryHistory.length})`}
          </h2>
        </div>
        {historyLoading ? (
          <div className="px-4 py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : deliveryHistory.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {deliveryHistory.map((entry, idx) => {
              const eventDate = entry.date instanceof Date ? entry.date : new Date(entry.date as any);
              return (
                <div key={idx} className="px-4 py-3 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {eventDate.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Campaign: {entry.campaignName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Delivered by: {entry.deliveredBy}
                    </div>
                    {entry.printoutName && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {entry.printoutName}
                      </div>
                    )}
                    {entry.notes && (
                      <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{entry.notes}</div>
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
            Reports {!reportsLoading && `(${propertyReports.length})`}
          </h2>
        </div>
        {reportsLoading ? (
          <div className="px-4 py-6 flex justify-center">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : propertyReports.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
            {propertyReports.map((report, idx) => {
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

export default PropertyDetailPage;
