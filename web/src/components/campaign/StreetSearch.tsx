import React, { useState, useCallback } from "react";

type StreetSearchProps = {
  suburb: string;
  postcode: string;
  state: string;
  onStreetSelected: (street: {
    streetName: string;
    lat: number;
    lng: number;
  }) => void;
};

/**
 * Simple street search using OpenStreetMap Nominatim API
 * Replaces Google Places Autocomplete with free OSM alternative
 */
const StreetSearch: React.FC<StreetSearchProps> = ({
  suburb,
  postcode,
  state,
  onStreetSelected,
}) => {
  const [streetInput, setStreetInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!streetInput.trim()) return;

    setSearching(true);
    setError(null);

    try {
      // Query OpenStreetMap Nominatim for the street
      const query = `${streetInput}, ${suburb}, ${postcode}, ${state}, Australia`;
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
        throw new Error("Search failed");
      }

      const results = await response.json();
      if (results.length === 0) {
        setError("Street not found. Try a different name.");
        return;
      }

      const result = results[0];
      onStreetSelected({
        streetName: result.address?.road || streetInput,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      });

      setStreetInput("");
    } catch (err) {
      console.error("Street search error:", err);
      setError("Failed to search. Please try again.");
    } finally {
      setSearching(false);
    }
  }, [streetInput, suburb, postcode, state, onStreetSelected]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Search for a street in {suburb} {postcode}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={streetInput}
          onChange={(e) => setStreetInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={`e.g. Collins Street`}
          disabled={searching}
          className="flex-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !streetInput.trim()}
          className="px-4 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};

export default StreetSearch;
