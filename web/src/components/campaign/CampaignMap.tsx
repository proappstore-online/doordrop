import React, { useEffect, useRef, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Circle,
  useMap,
  Popup,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { DoorData } from "../../models/door";
import type { TrackPoint, TrackStop } from "../../models/campaign";
import type { OverpassAddress } from "../../utils/overpassQuery";

// Fix for default marker icons in Leaflet
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
import iconRetina from "leaflet/dist/images/marker-icon-2x.png";

const DefaultIcon = L.icon({
  iconUrl: icon,
  iconRetinaUrl: iconRetina,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

/**
 * Spread markers that share the same lat/lng into a small circle
 */
function spreadOverlapping(
  items: { lat: number; lng: number }[]
): { lat: number; lng: number }[] {
  const groups: Record<string, number[]> = {};
  items.forEach((item, i) => {
    const key = `${item.lat},${item.lng}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(i);
  });

  const result = items.map((item) => ({ lat: item.lat, lng: item.lng }));
  for (const indices of Object.values(groups)) {
    if (indices.length <= 1) continue;
    const radius = 0.0002; // ~20m
    indices.forEach((idx: number, j: number) => {
      const angle = (2 * Math.PI * j) / indices.length;
      result[idx] = {
        lat: items[idx].lat + radius * Math.cos(angle),
        lng: items[idx].lng + radius * Math.sin(angle),
      };
    });
  }
  return result;
}

function dotColorForDoor(door: DoorData): string {
  if (door.status === "delivered") return "#10b981";
  if (door.status === "reported") return "#f59e0b";
  return "#ef4444";
}

// Custom marker icons
const createDoorIcon = (color: string) =>
  L.divIcon({
    className: "custom-door-marker",
    html: `<div style="width: 12px; height: 12px; border-radius: 50%; background-color: ${color}; border: 2px solid ${color === "#10b981" ? "#059669" : color === "#f59e0b" ? "#d97706" : "#dc2626"}; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const walkerIcon = L.divIcon({
  className: "custom-walker-marker",
  html: `
    <div style="position: relative;">
      <div style="position: absolute; top: -6px; left: -6px; width: 24px; height: 24px; border-radius: 50%; background-color: #3b82f6; opacity: 0.3; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
      <div style="width: 12px; height: 12px; border-radius: 50%; background-color: #2563eb; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>
    </div>
  `,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

const stopIcon = L.divIcon({
  className: "custom-stop-marker",
  html: `<div style="width: 12px; height: 12px; border-radius: 50%; background: #f97316; border: 2px solid #fff; box-shadow: 0 0 4px rgba(249,115,22,0.5);"></div>`,
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

// Auto-center component
function AutoCenter({
  position,
  isTracking,
}: {
  position: { lat: number; lng: number } | null | undefined;
  isTracking: boolean;
}) {
  const map = useMap();
  const prevPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const zoomSetRef = useRef(false);

  useEffect(() => {
    if (!isTracking || !position) {
      zoomSetRef.current = false;
      return;
    }

    // Set zoom once when tracking starts
    if (!zoomSetRef.current) {
      map.setZoom(18);
      zoomSetRef.current = true;
    }

    // Only pan if position changed significantly (> 5 meters)
    const prev = prevPositionRef.current;
    if (prev) {
      const latDiff = Math.abs(position.lat - prev.lat);
      const lngDiff = Math.abs(position.lng - prev.lng);
      const threshold = 0.00005; // ~5 meters

      if (latDiff < threshold && lngDiff < threshold) {
        return;
      }
    }

    map.panTo([position.lat, position.lng]);
    prevPositionRef.current = position;
  }, [map, isTracking, position]);

  return null;
}

// Fit bounds component
function FitBounds({
  doors,
  availableAddresses,
  isTracking,
}: {
  doors: (DoorData & { id?: string })[];
  availableAddresses: OverpassAddress[];
  isTracking: boolean;
}) {
  const map = useMap();
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (isTracking) return;

    const withCoords = doors.filter((d) => d.lat && d.lng);
    const allPoints = [
      ...withCoords.map((d) => ({ lat: d.lat!, lng: d.lng! })),
      ...availableAddresses.map((a) => ({ lat: a.lat, lng: a.lng })),
    ];

    // Only refit when point count changes
    if (allPoints.length === prevCountRef.current || allPoints.length === 0) return;
    prevCountRef.current = allPoints.length;

    const bounds = L.latLngBounds(allPoints.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, isTracking, doors, availableAddresses]);

  return null;
}

type CampaignMapProps = {
  center: { lat: number; lng: number };
  zoom?: number;
  doors: (DoorData & { id?: string })[];
  availableAddresses?: OverpassAddress[];
  selectedDoorKeys?: Set<string>;
  onMarkerClick?: (address: OverpassAddress) => void;
  onDoorClick?: (door: DoorData & { id?: string }) => void;
  walkerPosition?: { lat: number; lng: number } | null;
  trackPoints?: TrackPoint[];
  trackStops?: TrackStop[];
  doorRadiusM?: number;
  isTracking?: boolean;
  className?: string;
};

const CampaignMapLeaflet: React.FC<CampaignMapProps> = ({
  center,
  zoom = 15,
  doors,
  availableAddresses = [],
  selectedDoorKeys,
  onMarkerClick,
  onDoorClick,
  walkerPosition,
  trackPoints,
  trackStops,
  doorRadiusM,
  isTracking = false,
  className,
}) => {
  const doorsWithCoords = useMemo(
    () => doors.filter((d) => d.lat && d.lng),
    [doors]
  );

  const spreadPositions = useMemo(
    () => spreadOverlapping(doorsWithCoords.map((d) => ({ lat: d.lat!, lng: d.lng! }))),
    [doorsWithCoords]
  );

  // Track polyline path
  const trackPath = useMemo(
    () => trackPoints?.map((p) => [p.lat, p.lng] as [number, number]) || [],
    [trackPoints]
  );

  return (
    <div className={className ?? "w-full h-[400px] rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600"}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={zoom}
        className="w-full h-full"
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Auto-center during tracking */}
        <AutoCenter position={walkerPosition} isTracking={isTracking} />

        {/* Fit bounds when not tracking */}
        <FitBounds
          doors={doors}
          availableAddresses={availableAddresses}
          isTracking={isTracking}
        />

        {/* Door markers with clustering */}
        <MarkerClusterGroup
          chunkedLoading
          maxClusterRadius={40}
          spiderfyOnMaxZoom={true}
          showCoverageOnHover={false}
        >
          {doorsWithCoords.map((door, i) => {
            const pos = spreadPositions[i];
            const color = dotColorForDoor(door);
            return (
              <Marker
                key={door.id || i}
                position={[pos.lat, pos.lng]}
                icon={createDoorIcon(color)}
                eventHandlers={{
                  click: () => onDoorClick?.(door),
                }}
              >
                <Popup>{door.address}</Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>

        {/* Available addresses */}
        {availableAddresses.map((addr) => {
          const isSelected = selectedDoorKeys?.has(addr.houseNumber);
          const color = isSelected ? "#10b981" : "#9ca3af";
          return (
            <Marker
              key={`avail-${addr.houseNumber}`}
              position={[addr.lat, addr.lng]}
              icon={createDoorIcon(color)}
              eventHandlers={{
                click: () => onMarkerClick?.(addr),
              }}
            >
              <Popup>
                {addr.houseNumber} {addr.street}
                {addr.commercial ? " (Commercial)" : ""}
              </Popup>
            </Marker>
          );
        })}

        {/* Walker position */}
        {walkerPosition && (
          <Marker
            position={[walkerPosition.lat, walkerPosition.lng]}
            icon={walkerIcon}
            zIndexOffset={1000}
          >
            <Popup>Your location</Popup>
          </Marker>
        )}

        {/* GPS track polyline */}
        {trackPath.length >= 2 && (
          <Polyline
            positions={trackPath}
            color="#3b82f6"
            weight={3}
            opacity={0.7}
          />
        )}

        {/* Track stops */}
        {trackStops?.map((stop, i) => {
          const dwellSec = stop.endTime - stop.startTime;
          const dwellLabel =
            dwellSec >= 60
              ? `${Math.floor(dwellSec / 60)}m ${dwellSec % 60}s`
              : `${dwellSec}s`;
          return (
            <Marker
              key={`stop-${i}`}
              position={[stop.lat, stop.lng]}
              icon={stopIcon}
            >
              <Popup>Stop: {dwellLabel}</Popup>
            </Marker>
          );
        })}

        {/* Geofence circles (only for < 100 doors) */}
        {doorRadiusM &&
          doorRadiusM > 0 &&
          doorsWithCoords.length <= 100 &&
          doorsWithCoords.map((d, i) => (
            <Circle
              key={`circle-${d.id || i}`}
              center={[d.lat!, d.lng!]}
              radius={doorRadiusM}
              pathOptions={{
                fillColor: "#3b82f6",
                fillOpacity: 0.08,
                color: "#3b82f6",
                opacity: 0.3,
                weight: 1,
              }}
            />
          ))}
      </MapContainer>

      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.1;
          }
        }
      `}</style>
    </div>
  );
};

export default React.memo(CampaignMapLeaflet);
