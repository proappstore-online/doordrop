import { useState, useMemo } from "react";
import { DoorRepository } from "../repositories/doorRepository";
import { PropertyRepository, propertyDocId } from "../repositories/propertyRepository";
import type { DoorData } from "../models/door";
import type { PropertyData } from "../models/property";
import type { CampaignData } from "../models/campaign";
import { fetchAddressesOnStreet, type OverpassAddress } from "../utils/overpassQuery";

export interface UseDoorManagementReturn {
  // Street search state
  currentStreet: { streetName: string; lat: number; lng: number } | null;
  availableAddresses: OverpassAddress[];
  overpassLoading: boolean;
  overpassError: string | null;
  manualOpen: boolean;
  mapCenter: { lat: number; lng: number };

  // Computed
  selectedDoorKeys: Set<string>;

  // Handlers
  handleStreetSelected: (street: { streetName: string; lat: number; lng: number }) => Promise<void>;
  toggleAddress: (addr: OverpassAddress) => Promise<void>;
  handleDoorsGenerated: (newDoors: DoorData[]) => Promise<void>;
  setManualOpen: (open: boolean) => void;
}

export function useDoorManagement(
  campaignId: string | undefined,
  currentUserId: string | undefined,
  campaign: (CampaignData & { id: string }) | null,
  doors: (DoorData & { id: string })[],
  _setDoors: React.Dispatch<React.SetStateAction<(DoorData & { id: string })[]>>
): UseDoorManagementReturn {
  const [currentStreet, setCurrentStreet] = useState<{ streetName: string; lat: number; lng: number } | null>(null);
  const [availableAddresses, setAvailableAddresses] = useState<OverpassAddress[]>([]);
  const [overpassLoading, setOverpassLoading] = useState(false);
  const [overpassError, setOverpassError] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number }>({ lat: -33.8688, lng: 151.2093 });

  const selectedDoorKeys = useMemo(() => {
    if (!currentStreet) return new Set<string>();
    return new Set(
      doors.filter((d) => d.streetName === currentStreet.streetName).map((d) => d.houseNumber)
    );
  }, [doors, currentStreet]);

  const handleStreetSelected = async (street: { streetName: string; lat: number; lng: number }) => {
    setCurrentStreet(street);
    setMapCenter({ lat: street.lat, lng: street.lng });
    setOverpassError(null);
    setOverpassLoading(true);
    setManualOpen(false);
    try {
      const addresses = await fetchAddressesOnStreet(street.streetName, street.lat, street.lng);
      setAvailableAddresses(addresses);
      if (addresses.length === 0) setManualOpen(true);
    } catch {
      setOverpassError("Could not fetch addresses. Use manual entry instead.");
      setManualOpen(true);
      setAvailableAddresses([]);
    } finally {
      setOverpassLoading(false);
    }
  };

  const toggleAddress = async (addr: OverpassAddress) => {
    if (!campaignId || !currentUserId) return;
    const streetName = currentStreet?.streetName || addr.street;
    if (selectedDoorKeys.has(addr.houseNumber)) {
      const door = doors.find((d) => d.streetName === streetName && d.houseNumber === addr.houseNumber);
      if (door?.id) {
        // Delete from Firestore (real-time subscription will update local state)
        await DoorRepository.deleteDoor(campaignId, door.id);
      }
    } else {
      const suburb = campaign?.suburb || "";
      const postcode = campaign?.postcode || "";
      const newDoor: DoorData = {
        address: `${addr.houseNumber} ${streetName}`,
        streetName,
        houseNumber: addr.houseNumber,
        lat: addr.lat,
        lng: addr.lng,
        status: "pending",
        propertyId: propertyDocId(`${addr.houseNumber} ${streetName}`, suburb, postcode),
      };
      // Add to Firestore (real-time subscription will update local state)
      await DoorRepository.addDoor(campaignId, newDoor);

      // Auto-save to account-level properties
      const property: PropertyData = {
        address: newDoor.address,
        streetName,
        houseNumber: addr.houseNumber,
        suburb: campaign?.suburb || "",
        postcode: campaign?.postcode || "",
        state: campaign?.state || "",
        lat: addr.lat,
        lng: addr.lng,
        commercial: addr.commercial,
        accessUserIds: [currentUserId],
        createdAt: new Date(),
      };
      PropertyRepository.addProperties(currentUserId, [property]).catch((err) =>
        console.error("Failed to auto-save property:", err)
      );
    }
  };

  const handleDoorsGenerated = async (newDoors: DoorData[]) => {
    if (!campaignId || !currentUserId) return;
    const suburb = campaign?.suburb || "";
    const postcode = campaign?.postcode || "";
    // Set propertyId on each door before saving
    const doorsWithPropertyId = newDoors.map((d) => ({
      ...d,
      propertyId: propertyDocId(d.address, suburb, postcode),
    }));
    // Create doors in Firestore (real-time subscription will update local state)
    await DoorRepository.createDoors(campaignId, doorsWithPropertyId);
    setCurrentStreet(null);

    // Auto-save to account-level properties
    const properties: PropertyData[] = newDoors.map((d) => ({
      address: d.address,
      streetName: d.streetName,
      houseNumber: d.houseNumber,
      suburb: campaign?.suburb || "",
      postcode: campaign?.postcode || "",
      state: campaign?.state || "",
      lat: d.lat,
      lng: d.lng,
      accessUserIds: [currentUserId],
      createdAt: new Date(),
    }));
    PropertyRepository.addProperties(currentUserId, properties).catch((err) =>
      console.error("Failed to auto-save properties:", err)
    );
  };

  return {
    currentStreet,
    availableAddresses,
    overpassLoading,
    overpassError,
    manualOpen,
    mapCenter,
    selectedDoorKeys,
    handleStreetSelected,
    toggleAddress,
    handleDoorsGenerated,
    setManualOpen,
  };
}
