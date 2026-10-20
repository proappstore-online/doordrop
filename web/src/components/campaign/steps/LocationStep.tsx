import React, { useState, useEffect, useCallback, useLayoutEffect, useRef } from "react";
import Select from "react-select";
import { AU_STATE_CITY_MAP } from "../../../data/countryData";
import type { CampaignData } from "../../../models/campaign";

interface LocationStepProps {
  data: Partial<CampaignData>;
  onChange: (data: Partial<CampaignData>) => void;
  isLoading?: boolean;
}

// Pause after the last keystroke before looking the address up, so typing doesn't send a request per character.
const GEOCODE_DEBOUNCE_MS = 600;
// Nominatim's usage policy allows at most one request per second.
const NOMINATIM_MIN_INTERVAL_MS = 1000;

// Identifies one address, so the same address is never looked up twice in a row.
const addressKey = (suburb?: string, postcode?: string, state?: string) => `${suburb ?? ""}|${postcode ?? ""}|${state ?? ""}`;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const LocationStep: React.FC<LocationStepProps> = ({ data, onChange, isLoading = false }) => {
  const [stateError, setStateError] = useState<string | null>(null);
  const [suburbError, setSuburbError] = useState<string | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Latest props, read by the geocode callback. Keeping them in a ref lets that callback stay stable
  // instead of being recreated on every data change (each lookup calls onChange, which changes data).
  const latestRef = useRef({ data, onChange, isLoading });
  useLayoutEffect(() => {
    latestRef.current = { data, onChange, isLoading };
  });
  const lastGeocodedKeyRef = useRef<string | null>(null);
  const lastRequestAtRef = useRef(0);
  const geocodeRunRef = useRef(0);

  const isDark = document.documentElement.classList.contains("dark");

  const validateState = (value: string) => {
    if (!value) return "State is required";
    return null;
  };

  const validateSuburb = (value: string | undefined | null) => {
    const val = (value ?? "").trim();
    if (!val) return "Suburb is required";
    if (/\d/.test(val)) return "Suburb cannot contain numbers";
    if (val.length > 100) return "Suburb must be 100 characters or fewer";
    return null;
  };

  const validatePostcode = (value: string | undefined | null) => {
    const val = (value ?? "").trim();
    if (!val) return "Postcode is required";
    if (!/^\d{4}$/.test(val)) return "Postcode must be a 4-digit number";
    return null;
  };

  const geocodeLocation = useCallback(
    async (key: string, suburb: string, postcode: string, state: string, maxRetries = 3) => {
      const runId = ++geocodeRunRef.current;
      // A result only counts if no newer lookup has started and the address on screen is still this one.
      const isCurrent = () => {
        const current = latestRef.current.data;
        return runId === geocodeRunRef.current && addressKey(current.suburb, current.postcode, current.state) === key;
      };

      setIsGeocoding(true);
      setGeocodeError(null);

      let coordinates: { lat: number; lng: number } | null = null;
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Keep at least one second between requests (Nominatim usage policy).
          const wait = lastRequestAtRef.current + NOMINATIM_MIN_INTERVAL_MS - Date.now();
          if (wait > 0) await sleep(wait);
          if (!isCurrent()) break;
          lastRequestAtRef.current = Date.now();

          const query = `${suburb}, ${postcode}, ${state}, Australia`;
          // Browser fetch can't set a User-Agent, so Nominatim sees the browser's default. A meaningful
          // User-Agent would need a server-side proxy; that is out of scope here.
          const response = await fetch(
            `https://nominatim.openstreetmap.org/search?` +
              new URLSearchParams({
                q: query,
                format: "json",
                limit: "1",
                addressdetails: "1",
              })
          );

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const results = await response.json();
          if (results.length === 0) {
            throw new Error("Location not found");
          }

          const result = results[0];
          coordinates = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
          break;
        } catch {
          // Last attempt failed: fall through to the failure handling below.
          if (attempt === maxRetries - 1) break;
          if (!isCurrent()) break;
          // Wait before retrying with exponential backoff
          await sleep(Math.pow(2, attempt) * 1000);
        }
      }

      if (isCurrent()) {
        const { data: current, onChange: notify } = latestRef.current;
        if (coordinates) {
          notify({ ...current, ...coordinates });
        } else {
          setGeocodeError(
            "Could not verify location coordinates. You can still continue, but precise door matching may be affected."
          );
          notify({ ...current, lat: undefined, lng: undefined });
        }
      }
      if (runId === geocodeRunRef.current) setIsGeocoding(false);
    },
    []
  );

  // Auto-geocode once per distinct address. Depends only on the address fields (plus isLoading, so a
  // lookup skipped while creating resumes afterwards; the dedupe key stops it repeating an address).
  // It does not re-run on error-state updates, on isGeocoding changes, or on the lat/lng that
  // geocoding writes back.
  useEffect(() => {
    const { suburb, postcode, state } = data;
    if (isLoading || !suburb || !postcode || !state || validateSuburb(suburb) || validatePostcode(postcode)) {
      return;
    }

    const key = addressKey(suburb, postcode, state);
    if (key === lastGeocodedKeyRef.current) return;

    // Debounced: typing restarts the timer, so only the address the user settles on is looked up.
    const timer = setTimeout(() => {
      // Set before the request so a failed lookup isn't retried for the same address; a new address still is.
      lastGeocodedKeyRef.current = key;
      void geocodeLocation(key, suburb, postcode, state);
    }, GEOCODE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [data.suburb, data.postcode, data.state, isLoading, geocodeLocation]);

  const handleStateChange = (option: { value: string; label: string } | null) => {
    const nextState = option?.value || "";
    const error = validateState(nextState);
    setStateError(error);
    setGeocodeError(null);
    onChange({ ...data, state: nextState });
  };

  const handleSuburbChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextSuburb = e.target.value;
    const error = validateSuburb(nextSuburb);
    setSuburbError(error);
    setGeocodeError(null);
    onChange({ ...data, suburb: nextSuburb });
  };

  const handlePostcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextPostcode = e.target.value.replace(/\D/g, "").slice(0, 4);
    const error = validatePostcode(nextPostcode);
    setPostcodeError(error);
    setGeocodeError(null);
    onChange({ ...data, postcode: nextPostcode });
  };

  const isValid = !validateState(data.state || "") && !validateSuburb(data.suburb) && !validatePostcode(data.postcode);

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Campaign location details</legend>

      <div>
        <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          State <span className="text-red-500">*</span>
        </label>
        <Select
          options={[...new Set(AU_STATE_CITY_MAP.map((item) => item.state))].map((state) => ({
            value: state,
            label: state,
          }))}
          value={data.state ? { value: data.state, label: data.state } : null}
          onChange={handleStateChange}
          isDisabled={isLoading}
          placeholder="Select a state"
          aria-invalid={Boolean(stateError)}
          aria-describedby={stateError ? "state-error" : undefined}
          menuPortalTarget={document.body}
          styles={{
            menuPortal: (base) => ({ ...base, zIndex: 9999 }),
            control: (base) => ({
              ...base,
              minHeight: 42,
              backgroundColor: isDark ? "#1f2937" : "#ffffff",
              color: isDark ? "#f3f4f6" : "#111827",
              borderColor: isDark ? "#4b5563" : "#d1d5db",
              boxShadow: "none",
            }),
            menu: (base) => ({ ...base, backgroundColor: isDark ? "#1f2937" : "#ffffff" }),
            singleValue: (base) => ({ ...base, color: isDark ? "#f3f4f6" : "#111827" }),
            input: (base) => ({ ...base, color: isDark ? "#f3f4f6" : "#111827" }),
            placeholder: (base) => ({ ...base, color: isDark ? "#9ca3af" : "#6b7280" }),
            option: (base, state) => ({
              ...base,
              backgroundColor: state.isFocused ? (isDark ? "#374151" : "#f3f4f6") : isDark ? "#1f2937" : "#ffffff",
              color: isDark ? "#f3f4f6" : "#111827",
            }),
          }}
        />
        {stateError && (
          <p id="state-error" className="text-sm text-red-500 mt-1">
            {stateError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="suburb" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Suburb <span className="text-red-500">*</span>
        </label>
        <input
          id="suburb"
          type="text"
          value={data.suburb || ""}
          onChange={handleSuburbChange}
          placeholder="e.g., Parramatta"
          maxLength={100}
          disabled={isLoading}
          aria-invalid={Boolean(suburbError)}
          aria-describedby={suburbError ? "suburb-error" : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
            suburbError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {suburbError && (
          <p id="suburb-error" className="text-sm text-red-500 mt-1">
            {suburbError}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="postcode" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Postcode <span className="text-red-500">*</span>
        </label>
        <input
          id="postcode"
          type="text"
          value={data.postcode || ""}
          onChange={handlePostcodeChange}
          placeholder="e.g., 2150"
          maxLength={4}
          inputMode="numeric"
          disabled={isLoading}
          aria-invalid={Boolean(postcodeError)}
          aria-describedby={postcodeError ? "postcode-error" : undefined}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
            postcodeError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
          }`}
        />
        {postcodeError && (
          <p id="postcode-error" className="text-sm text-red-500 mt-1">
            {postcodeError}
          </p>
        )}
      </div>

      {isGeocoding && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200 flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-blue-400 border-t-blue-800 rounded-full animate-spin" />
          Verifying location coordinates...
        </div>
      )}

      {geocodeError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          ⚠️ {geocodeError}
        </div>
      )}

      {isValid && !isGeocoding && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
          ✓ Location validated successfully {data.lat && data.lng ? `(${data.lat.toFixed(4)}, ${data.lng.toFixed(4)})` : ""}
        </div>
      )}
    </fieldset>
  );
};

export default LocationStep;
