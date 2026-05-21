import React, { useState, useRef, useEffect } from "react";
import { searchSuburbs, type AustralianSuburb } from "../data/australianSuburbs";

type SuburbPostcodeAutocompleteProps = {
  suburb: string;
  postcode: string;
  state: string;
  onSuburbChange: (suburb: string) => void;
  onPostcodeChange: (postcode: string) => void;
  onStateChange: (state: string) => void;
  disabled?: boolean;
  required?: boolean;
  className?: string;
};

const SuburbPostcodeAutocomplete: React.FC<SuburbPostcodeAutocompleteProps> = ({
  suburb,
  postcode,
  state,
  onSuburbChange,
  onPostcodeChange,
  onStateChange,
  disabled = false,
  required = false,
  className = "",
}) => {
  const [query, setQuery] = useState(suburb);
  const [suggestions, setSuggestions] = useState<AustralianSuburb[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const requestIdRef = useRef(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync query with prop suburb
  useEffect(() => {
    setQuery(suburb);
  }, [suburb]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleInputChange = (value: string) => {
    setQuery(value);
    onSuburbChange(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const id = ++requestIdRef.current;
      const results = await searchSuburbs(value, 10);
      // Ignore stale responses
      if (id !== requestIdRef.current) return;
      setSuggestions(results);
      setShowSuggestions(true);
      setHighlightedIndex(-1);
      setLoading(false);
    }, 300);
  };

  const selectSuggestion = (suggestion: AustralianSuburb) => {
    setQuery(suggestion.suburb);
    onSuburbChange(suggestion.suburb);
    onPostcodeChange(suggestion.postcode);
    onStateChange(suggestion.state);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          selectSuggestion(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        break;
    }
  };

  const inputCls = `w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-700`;

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Suburb Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Suburb {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (query.trim() && suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            disabled={disabled}
            placeholder="Start typing suburb or postcode..."
            className={inputCls}
            autoComplete="off"
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-emerald-500 rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((suggestion, index) => (
              <div
                key={`${suggestion.suburb}-${suggestion.postcode}`}
                onClick={() => selectSuggestion(suggestion)}
                className={`px-3 py-2 cursor-pointer transition-colors ${
                  index === highlightedIndex
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {suggestion.suburb}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  {suggestion.postcode}, {suggestion.state}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Postcode (read-only, auto-filled) */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Postcode {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={postcode}
          onChange={(e) => onPostcodeChange(e.target.value)}
          disabled={disabled}
          maxLength={4}
          placeholder="Auto-filled from suburb"
          className={inputCls}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select a suburb above to auto-fill postcode
        </p>
      </div>

      {/* State (read-only, auto-filled) */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          State {required && <span className="text-red-500">*</span>}
        </label>
        <input
          type="text"
          value={state}
          disabled
          className={`${inputCls} bg-gray-100 dark:bg-gray-700`}
          placeholder="Auto-filled from suburb"
        />
      </div>
    </div>
  );
};

export default SuburbPostcodeAutocomplete;
