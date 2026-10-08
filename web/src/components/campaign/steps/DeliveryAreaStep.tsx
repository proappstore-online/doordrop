import React, { useState } from "react";
import type { CampaignData } from "../../../models/campaign";

interface DeliveryAreaStepProps {
  data: Partial<CampaignData>;
  onChange: (data: Partial<CampaignData>) => void;
  isLoading?: boolean;
}

const DeliveryAreaStep: React.FC<DeliveryAreaStepProps> = ({ data, onChange, isLoading = false }) => {
  const [error, setError] = useState<string | null>(null);

  // doorRadiusM is stored in meters; convert to km for display
  const radiusKm = data.doorRadiusM ? Math.round(data.doorRadiusM / 1000) : "";

  // Estimate door count: π * r² * average density (650 doors/km² for Australian suburbs)
  const AVERAGE_DOORS_PER_KM2 = 650;
  const estimateDoorCount = (radiusKm: number): number => {
    return Math.round(Math.PI * radiusKm * radiusKm * AVERAGE_DOORS_PER_KM2);
  };
  const estimatedDoors = radiusKm ? estimateDoorCount(Number(radiusKm)) : 0;

  const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setError(null);

    if (value === "") {
      onChange({ ...data, doorRadiusM: undefined });
      return;
    }

    const km = parseFloat(value);
    if (isNaN(km) || km <= 0) {
      setError("Delivery radius must be a positive number");
      return;
    }
    if (km > 100) {
      setError("Delivery radius should be 100 km or less");
      return;
    }

    // Convert km to meters for storage
    onChange({ ...data, doorRadiusM: km * 1000 });
  };

  const isValid = data.doorRadiusM !== undefined && data.doorRadiusM > 0 && !error;

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Delivery area settings</legend>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Delivery radius:</strong> How far walkers should deliver from the campaign center point. Walkers won't visit properties beyond this radius.
        </p>
      </div>

      <div>
        <label htmlFor="delivery-radius" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Delivery Radius <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <input
            id="delivery-radius"
            type="number"
            value={radiusKm}
            onChange={handleRadiusChange}
            placeholder="e.g., 5"
            min="0.1"
            max="100"
            step="0.5"
            disabled={isLoading}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "radius-error" : "radius-hint"}
            className={`flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
              error ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
          />
          <span className="text-gray-600 dark:text-gray-400 font-medium">km</span>
        </div>
        {error && (
          <p id="radius-error" className="text-sm text-red-500 mt-2">
            {error}
          </p>
        )}
        {!error && (
          <p id="radius-hint" className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Recommended: 2–10 km depending on neighborhood density
          </p>
        )}
      </div>

      {isValid && (
        <div className="space-y-3">
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
            ✓ Delivery area set to {radiusKm} km
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200">
            <p className="font-medium">Estimated delivery scope</p>
            <p className="mt-1">
              Approximately <strong>{estimatedDoors.toLocaleString()}</strong> properties in your delivery area (based on Australian suburban density)
            </p>
          </div>
        </div>
      )}
    </fieldset>
  );
};

export default DeliveryAreaStep;
