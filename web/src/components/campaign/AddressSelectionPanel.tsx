import React from "react";
import StreetSearch from "./StreetSearch";
import DoorSelector from "./DoorSelector";
import type { OverpassAddress } from "../../utils/overpassQuery";
import type { DoorData } from "../../models/door";

const categoryColors: Record<string, string> = {
  health: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  food: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  retail: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  office: "bg-gray-100 text-gray-700 dark:bg-gray-700/50 dark:text-gray-300",
  trade: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  default: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
};

interface AddressSelectionPanelProps {
  suburb: string;
  postcode: string;
  state: string;
  currentStreet: { streetName: string; lat: number; lng: number } | null;
  availableAddresses: OverpassAddress[];
  selectedDoorKeys: Set<string>;
  overpassLoading: boolean;
  overpassError: string | null;
  manualOpen: boolean;
  onStreetSelected: (street: { streetName: string; lat: number; lng: number }) => void;
  onToggleAddress: (addr: OverpassAddress) => void;
  onToggleManual: () => void;
  onDoorsGenerated: (doors: DoorData[]) => void;
}

const AddressSelectionPanel: React.FC<AddressSelectionPanelProps> = ({
  suburb,
  postcode,
  state,
  currentStreet,
  availableAddresses,
  selectedDoorKeys,
  overpassLoading,
  overpassError,
  manualOpen,
  onStreetSelected,
  onToggleAddress,
  onToggleManual,
  onDoorsGenerated,
}) => {
  return (
    <>
      <StreetSearch
        suburb={suburb}
        postcode={postcode}
        state={state}
        onStreetSelected={onStreetSelected}
      />

      {overpassLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Searching for addresses...
        </div>
      )}

      {overpassError && (
        <p className="text-sm text-amber-600 dark:text-amber-400">{overpassError}</p>
      )}

      {!overpassLoading && availableAddresses.length > 0 && currentStreet && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Found: {availableAddresses.length} addresses on {currentStreet.streetName}
            </span>
            <button
              onClick={() => {
                const unselected = availableAddresses.filter((a) => !selectedDoorKeys.has(a.houseNumber));
                unselected.forEach((addr) => onToggleAddress(addr));
              }}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Select all
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-1">
            {availableAddresses.map((addr) => (
              <label
                key={addr.houseNumber}
                className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-1 py-0.5"
              >
                <input
                  type="checkbox"
                  checked={selectedDoorKeys.has(addr.houseNumber)}
                  onChange={() => onToggleAddress(addr)}
                  className="accent-emerald-600"
                />
                {addr.houseNumber} {addr.street}
                {addr.businessType ? (
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${categoryColors[addr.businessCategory!] ?? categoryColors.default}`}>
                    {addr.businessType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                ) : addr.commercial ? (
                  <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                    Commercial
                  </span>
                ) : null}
              </label>
            ))}
          </div>
        </div>
      )}

      {currentStreet && (
        <div>
          <button
            onClick={onToggleManual}
            className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <span className="text-xs">{manualOpen ? "\u25BE" : "\u25B8"}</span>
            Manual range entry
          </button>
          {manualOpen && (
            <div className="mt-2">
              <DoorSelector
                streetName={currentStreet.streetName}
                streetLat={currentStreet.lat}
                streetLng={currentStreet.lng}
                onDoorsGenerated={onDoorsGenerated}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default AddressSelectionPanel;
