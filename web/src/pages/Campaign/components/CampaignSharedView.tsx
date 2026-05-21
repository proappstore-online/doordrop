import React, { useState, useMemo } from "react";
import type { CampaignData, TrackPoint, TrackStop } from "../../../models/campaign";
import type { DoorData } from "../../../models/door";
import type { PrintoutData } from "../../../models/printout";
import CampaignMap from "../../../components/campaign/CampaignMap";
import CampaignTabs from "../../../components/campaign/CampaignTabs";
import CampaignStats from "../../../components/campaign/CampaignStats";
import DoorList from "../../../components/campaign/DoorList";
import DoorDetailPanel from "../../../components/campaign/DoorDetailPanel";
import DoorReportModal from "../../../components/campaign/DoorReportModal";
import type { OverpassAddress } from "../../../utils/overpassQuery";
import { sortDoorsAlongStreet } from "../../../utils/sortDoorsGeo";

interface CampaignSharedViewProps {
  campaign: CampaignData & { id: string };
  campaignId: string;
  doors: (DoorData & { id?: string })[];
  printouts: (PrintoutData & { id: string })[];
  currentUserId?: string;
  canEditDoors: boolean;
  showStats?: boolean;

  // Map props
  currentStreet: { streetName: string; lat: number; lng: number } | null;
  mapCenter: { lat: number; lng: number };
  availableAddresses: OverpassAddress[];
  selectedDoorKeys: Set<string>;
  walkerPosition?: { lat: number; lng: number } | null;
  trackPoints?: TrackPoint[];
  trackStops?: TrackStop[];
  shouldFollowTracker?: boolean;

  // Door interactions
  onToggleAddress?: (addr: OverpassAddress) => void;
  onDoorClick?: (door: DoorData & { id?: string }) => void;
  onDoorReport?: (door: DoorData & { id?: string }) => void;
  onDoorReported?: (doorId: string) => void;
}

const CampaignSharedView: React.FC<CampaignSharedViewProps> = ({
  campaign,
  campaignId,
  doors,
  printouts,
  currentUserId,
  canEditDoors,
  showStats = true,
  currentStreet,
  mapCenter,
  availableAddresses,
  selectedDoorKeys,
  walkerPosition,
  trackPoints = [],
  trackStops = [],
  shouldFollowTracker = false,
  onToggleAddress,
  onDoorClick,
  onDoorReport,
  onDoorReported,
}) => {
  const [expandedStreets, setExpandedStreets] = useState<Set<string>>(new Set());
  const [expandedDoorId, setExpandedDoorId] = useState<string | null>(null);
  const [reportingDoor, setReportingDoor] = useState<(DoorData & { id: string }) | null>(null);
  const [selectedDoor, setSelectedDoor] = useState<(DoorData & { id: string }) | null>(null);

  // Calculate center for map
  const computedCenter = useMemo(() => {
    const withCoords = doors.filter((d) => d.lat && d.lng);
    if (withCoords.length > 0) {
      return {
        lat: withCoords.reduce((s, d) => s + d.lat!, 0) / withCoords.length,
        lng: withCoords.reduce((s, d) => s + d.lng!, 0) / withCoords.length,
      };
    }
    if (campaign.lat != null && campaign.lng != null) {
      return { lat: campaign.lat, lng: campaign.lng };
    }
    return { lat: -33.8688, lng: 151.2093 };
  }, [doors.length, campaign.lat, campaign.lng]);

  const effectiveCenter = currentStreet ? mapCenter : computedCenter;

  // Filter doors for map (exclude those in available addresses)
  const mapDoors = useMemo(
    () =>
      doors.filter(
        (d) =>
          !currentStreet ||
          d.streetName !== currentStreet.streetName ||
          !availableAddresses.some((a) => a.houseNumber === d.houseNumber)
      ),
    [doors, currentStreet, availableAddresses]
  );

  // Group doors by street (only doors with ids)
  const doorsByStreet = useMemo(() => {
    const grouped: Record<string, {
      doors: (DoorData & { id: string })[];
      delivered: number;
      pending: number;
      reported: number;
    }> = {};
    doors.forEach((door) => {
      if (!door.id) return; // Skip doors without ids
      const street = door.streetName;
      if (!grouped[street]) grouped[street] = { doors: [], delivered: 0, pending: 0, reported: 0 };
      grouped[street].doors.push(door as DoorData & { id: string });
      if (door.status === "delivered") grouped[street].delivered++;
      else if (door.status === "reported") grouped[street].reported++;
      else grouped[street].pending++;
    });
    // Sort doors within each street by geographic order
    for (const group of Object.values(grouped)) {
      group.doors = sortDoorsAlongStreet(group.doors);
    }
    return grouped;
  }, [doors]);

  const toggleStreet = (street: string) => {
    setExpandedStreets(prev => {
      const next = new Set(prev);
      if (next.has(street)) next.delete(street);
      else next.add(street);
      return next;
    });
  };

  const handleDoorClick = (door: DoorData & { id?: string }) => {
    if (onDoorClick && door.id) {
      onDoorClick(door as DoorData & { id: string });
    }
  };

  const handleDoorReport = (door: DoorData & { id?: string }) => {
    if (onDoorReport && door.id) {
      setReportingDoor(door as DoorData & { id: string });
    }
  };

  const handleDoorReported = (doorId: string) => {
    setReportingDoor(null);
    if (onDoorReported) {
      onDoorReported(doorId);
    }
  };

  // Keep selectedDoor in sync with live door data
  const liveDoor = useMemo(() => {
    if (!selectedDoor) return null;
    const found = doors.find((d) => d.id === selectedDoor.id);
    return found && found.id ? (found as DoorData & { id: string }) : null;
  }, [doors, selectedDoor?.id]);

  const deliveredCount = doors.filter((d) => d.status === "delivered").length;
  const reportedCount = doors.filter((d) => d.status === "reported").length;

  return (
    <>
      <CampaignTabs
        campaignId={campaignId}
        campaignName={campaign.name}
        status={`${campaign.suburb} ${campaign.postcode}`}
        campaignStatus={campaign.status}
      />

      {showStats && campaign.status !== "draft" && (
        <CampaignStats
          campaign={campaign}
          totalDoors={doors.length}
          deliveredCount={deliveredCount}
          reportedCount={reportedCount}
        />
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        {/* Map */}
        <CampaignMap
          center={effectiveCenter}
          doors={mapDoors}
          availableAddresses={availableAddresses}
          selectedDoorKeys={selectedDoorKeys}
          onMarkerClick={onToggleAddress}
          onDoorClick={canEditDoors ? handleDoorClick : undefined}
          walkerPosition={walkerPosition}
          trackPoints={trackPoints.length > 0 ? trackPoints : undefined}
          trackStops={trackStops.length > 0 ? trackStops : undefined}
          doorRadiusM={campaign.doorRadiusM}
          isTracking={shouldFollowTracker}
          className="flex-1 h-[350px] lg:h-[600px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"
        />

        {/* Door List */}
        <div className="w-full lg:w-96">
          <DoorList
            campaignId={campaignId}
            doorsByStreet={doorsByStreet}
            expandedStreets={expandedStreets}
            expandedDoorId={expandedDoorId}
            printouts={printouts}
            canEditDoors={canEditDoors}
            onToggleStreet={toggleStreet}
            onToggleDoor={setExpandedDoorId}
            onDoorClick={handleDoorClick}
            onDoorReport={handleDoorReport}
            onDoorSelect={setSelectedDoor}
          />
        </div>
      </div>

      {/* Door Detail Panel */}
      {liveDoor && (
        <DoorDetailPanel
          door={liveDoor}
          printouts={printouts}
          canEditDoors={canEditDoors}
          onDoorClick={handleDoorClick}
          onClose={() => setSelectedDoor(null)}
        />
      )}

      {/* Door Report Modal */}
      {reportingDoor && currentUserId && reportingDoor.propertyId && (
        <DoorReportModal
          campaignId={campaignId}
          door={reportingDoor}
          propertyId={reportingDoor.propertyId}
          reportedBy={currentUserId}
          onClose={() => setReportingDoor(null)}
          onReported={handleDoorReported}
        />
      )}
    </>
  );
};

export default CampaignSharedView;
