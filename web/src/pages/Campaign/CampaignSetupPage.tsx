import React, { useRef, useState } from "react";
import Select from "react-select";
import { useNavigate } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import { AU_STATE_CITY_MAP } from "../../data/countryData";

const CampaignSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthContext();

  const [selectedState, setSelectedState] = useState<string>("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [saving, setSaving] = useState(false);
  const [suburbError, setSuburbError] = useState<string | null>(null);
  const [postcodeError, setPostcodeError] = useState<string | null>(null);
  const [stateError, setStateError] = useState<string | null>(null);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submissionInFlight = useRef(false);

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

  const collapseSpaces = (s: string) => s.trim().replace(/\s+/g, " ");

  const handleCreate = async () => {
    if (submissionInFlight.current) return;

    const nextStateError = validateState(selectedState);
    const nextSuburbError = validateSuburb(suburb);
    const nextPostcodeError = validatePostcode(postcode);
    setStateError(nextStateError);
    setSuburbError(nextSuburbError);
    setPostcodeError(nextPostcodeError);
    setGeocodeError(null);
    setSubmitError(null);

    if (nextStateError || nextSuburbError || nextPostcodeError) return;

    if (!currentUser) {
      setSubmitError("Your session has expired. Please sign in again, then try creating the campaign.");
      return;
    }

    submissionInFlight.current = true;
    setSaving(true);
    try {
      const displaySuburb = collapseSpaces(suburb).toLowerCase();
      const displayPostcode = collapseSpaces(postcode);

      // Geocode to validate suburb/postcode and get coordinates
      const query = encodeURIComponent(`${displaySuburb} ${displayPostcode} ${selectedState} Australia`);
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 10_000);
      let res: Response;
      try {
        res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=au`,
          { signal: controller.signal }
        );
      } finally {
        window.clearTimeout(timeoutId);
      }

      if (!res.ok) {
        throw new Error("GEOCODING_UNAVAILABLE");
      }

      const data: unknown = await res.json();

      if (!Array.isArray(data) || data.length === 0 || !data[0]) {
        setGeocodeError(
          "We could not verify that suburb and postcode. Check the state, suburb spelling, and postcode, then try again."
        );
        return;
      }

      const result = data[0] as { lat?: string; lon?: string };
      const lat = Number.parseFloat(result.lat ?? "");
      const lng = Number.parseFloat(result.lon ?? "");
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        setGeocodeError(
          "We could not verify that location. Check the state, suburb spelling, and postcode, then try again."
        );
        return;
      }

      const displayName = `${displaySuburb} ${displayPostcode}`;
      const nameKey = `${displaySuburb} ${displayPostcode.toLowerCase()}`;

      const groupId = await CampaignRepository.createGroup({
        name: displayName,
        nameKey,
        suburb: displaySuburb,
        postcode: displayPostcode,
        country: "AU",
        state: selectedState,
        planType: "roster",
        adminIds: [currentUser.id],
        createdAt: new Date(),
        memberIds: [currentUser.id],
        status: "draft",
        lat,
        lng,
      } as any);

      navigate(`/app/campaign/${groupId}`);
    } catch (err) {
      console.error("Create campaign failed", err);
      if (err instanceof Error && err.name === "AbortError") {
        setGeocodeError(
          "Location verification took too long. Check your connection and try again."
        );
      } else if (err instanceof Error && err.message === "GEOCODING_UNAVAILABLE") {
        setGeocodeError(
          "Location verification is temporarily unavailable. Please try again in a moment."
        );
      } else {
        setSubmitError(
          "We could not create your campaign. Your details have been kept—please try again."
        );
      }
    } finally {
      setSaving(false);
      submissionInFlight.current = false;
    }
  };

  const isDark = document.documentElement.classList.contains("dark");

  return (
    <div className="max-w-lg mx-auto mt-8 px-4 pb-8">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
        New Campaign
      </h1>

      <div className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            State
          </label>
          <Select
            options={[...new Set(AU_STATE_CITY_MAP.map((item) => item.state))].map((state) => ({
              value: state,
              label: state,
            }))}
            value={selectedState ? { value: selectedState, label: selectedState } : null}
            onChange={(option) => {
              const nextState = option?.value || "";
              setSelectedState(nextState);
              setStateError(validateState(nextState));
              setGeocodeError(null);
              setSubmitError(null);
            }}
            isDisabled={saving}
            placeholder="Select a state"
            aria-invalid={Boolean(stateError)}
            aria-describedby={stateError ? "campaign-state-error" : undefined}
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
                backgroundColor: state.isFocused
                  ? isDark ? "#374151" : "#f3f4f6"
                  : isDark ? "#1f2937" : "#ffffff",
                color: isDark ? "#f3f4f6" : "#111827",
              }),
            }}
          />
          {stateError && <p id="campaign-state-error" className="text-sm text-red-500 mt-1">{stateError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Suburb <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={suburb}
            onChange={(e) => {
              const nextSuburb = e.target.value;
              setSuburb(nextSuburb);
              setSuburbError(validateSuburb(nextSuburb));
              setGeocodeError(null);
              setSubmitError(null);
            }}
            onBlur={(e) => {
              setSuburbError(validateSuburb(e.target.value));
            }}
            maxLength={100}
            aria-invalid={Boolean(suburbError)}
            aria-describedby={suburbError ? "campaign-suburb-error" : undefined}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              suburbError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
          />
          {suburbError && <p id="campaign-suburb-error" className="text-sm text-red-500 mt-1">{suburbError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Postcode <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => {
              const nextPostcode = e.target.value.replace(/\D/g, "").slice(0, 4);
              setPostcode(nextPostcode);
              setPostcodeError(validatePostcode(nextPostcode));
              setGeocodeError(null);
              setSubmitError(null);
            }}
            onBlur={(e) => {
              setPostcodeError(validatePostcode(e.target.value));
            }}
            inputMode="numeric"
            maxLength={4}
            aria-invalid={Boolean(postcodeError)}
            aria-describedby={postcodeError ? "campaign-postcode-error" : undefined}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              postcodeError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
          />
          {postcodeError && <p id="campaign-postcode-error" className="text-sm text-red-500 mt-1">{postcodeError}</p>}
        </div>

        {(geocodeError || submitError) && (
          <p className="text-sm text-red-500" role="alert">
            {geocodeError || submitError}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={saving}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {saving ? "Creating..." : "Create Campaign"}
        </button>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Your campaign will be created as a draft. You can add streets, set a budget, and publish it when ready.
        </p>
      </div>
    </div>
  );
};

export default CampaignSetupPage;
