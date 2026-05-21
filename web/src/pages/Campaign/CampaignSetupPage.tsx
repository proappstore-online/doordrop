import React, { useState } from "react";
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
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  const validateNoNumber = (value: string | undefined | null) => {
    const val = (value ?? "").trim();
    if (/\d/.test(val)) return "Suburb cannot contain numbers";
    return null;
  };

  const collapseSpaces = (s: string) => s.trim().replace(/\s+/g, " ");

  const handleCreate = async () => {
    if (!currentUser || !suburb.trim() || !postcode.trim()) return;
    setSaving(true);
    setGeocodeError(null);
    try {
      const displaySuburb = collapseSpaces(suburb).toLowerCase();
      const displayPostcode = collapseSpaces(postcode);

      // Geocode to validate suburb/postcode and get coordinates
      const query = encodeURIComponent(`${displaySuburb} ${displayPostcode} ${selectedState} Australia`);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=au`
      );
      const data = await res.json();

      if (!data || data.length === 0) {
        setGeocodeError("Could not find this suburb/postcode combination");
        setSaving(false);
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);

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
    } finally {
      setSaving(false);
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
            onChange={(option) => setSelectedState(option?.value || "")}
            isDisabled={saving}
            placeholder="Select a state"
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
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Suburb <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={suburb}
            onChange={(e) => setSuburb(e.target.value)}
            onBlur={(e) => {
              const v = (e.target.value || "").trim();
              if (!v) { setSuburbError("Suburb is required"); return; }
              setSuburbError(validateNoNumber(v));
            }}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              suburbError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
          />
          {suburbError && <p className="text-sm text-red-500 mt-1">{suburbError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            Postcode <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value)}
            onBlur={(e) => {
              const v = (e.target.value || "").trim();
              if (!v) { setPostcodeError("Postcode is required"); return; }
              if (!/^\d{4}$/.test(v)) { setPostcodeError("Postcode must be a 4-digit number"); return; }
              setPostcodeError(null);
            }}
            className={`w-full px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 ${
              postcodeError ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            } focus:outline-none focus:ring-2 focus:ring-emerald-500`}
          />
          {postcodeError && <p className="text-sm text-red-500 mt-1">{postcodeError}</p>}
        </div>

        {geocodeError && <p className="text-sm text-red-500">{geocodeError}</p>}

        <button
          onClick={handleCreate}
          disabled={saving || !suburb.trim() || !postcode.trim() || Boolean(suburbError) || Boolean(postcodeError)}
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
