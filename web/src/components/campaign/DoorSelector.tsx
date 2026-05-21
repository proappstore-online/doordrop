import React, { useState } from "react";
import type { DoorData } from "../../models/door";

type DoorSelectorProps = {
  streetName: string;
  streetLat: number;
  streetLng: number;
  onDoorsGenerated: (doors: DoorData[]) => void;
};

type Parity = "all" | "odd" | "even";

const DoorSelector: React.FC<DoorSelectorProps> = ({
  streetName,
  streetLat,
  streetLng,
  onDoorsGenerated,
}) => {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [parity, setParity] = useState<Parity>("all");
  const [generated, setGenerated] = useState<DoorData[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const handleGenerate = () => {
    const start = parseInt(from, 10);
    const end = parseInt(to, 10);
    if (isNaN(start) || isNaN(end) || start > end || start < 1) return;

    const doors: DoorData[] = [];
    for (let num = start; num <= end; num++) {
      if (parity === "odd" && num % 2 === 0) continue;
      if (parity === "even" && num % 2 !== 0) continue;
      doors.push({
        address: `${num} ${streetName}`,
        streetName,
        houseNumber: String(num),
        lat: streetLat,
        lng: streetLng,
        status: "pending",
      });
    }
    setGenerated(doors);
    setChecked(new Set(doors.map((d) => d.houseNumber)));
  };

  const toggleDoor = (houseNumber: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(houseNumber)) next.delete(houseNumber);
      else next.add(houseNumber);
      return next;
    });
  };

  const handleAdd = () => {
    const selected = generated.filter((d) => checked.has(d.houseNumber));
    if (selected.length === 0) return;
    onDoorsGenerated(selected);
    setGenerated([]);
    setFrom("");
    setTo("");
    setChecked(new Set());
  };

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
        Add doors on <strong>{streetName}</strong>
      </p>

      <div className="flex gap-3 items-end flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
          <input
            type="number"
            min="1"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
          <input
            type="number"
            min="1"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="w-24 px-2 py-1.5 border rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <div className="flex gap-3 items-center">
          {(["all", "odd", "even"] as Parity[]).map((p) => (
            <label key={p} className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="radio"
                name="parity"
                value={p}
                checked={parity === p}
                onChange={() => setParity(p)}
                className="accent-emerald-600"
              />
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </label>
          ))}
        </div>
        <button
          onClick={handleGenerate}
          disabled={!from || !to}
          className="px-4 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
        >
          Generate
        </button>
      </div>

      {generated.length > 0 && (
        <div className="space-y-2">
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md p-2 space-y-1">
            {generated.map((door) => (
              <label
                key={door.houseNumber}
                className="flex items-center gap-2 text-sm text-gray-800 dark:text-gray-200"
              >
                <input
                  type="checkbox"
                  checked={checked.has(door.houseNumber)}
                  onChange={() => toggleDoor(door.houseNumber)}
                  className="accent-emerald-600"
                />
                {door.address}
              </label>
            ))}
          </div>
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {checked.size} of {generated.length} selected
              </span>
              <button
                onClick={() => {
                  if (checked.size === generated.length) {
                    setChecked(new Set());
                  } else {
                    setChecked(new Set(generated.map((d) => d.houseNumber)));
                  }
                }}
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                {checked.size === generated.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <button
              onClick={handleAdd}
              disabled={checked.size === 0}
              className="px-4 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-sm"
            >
              Add Doors
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoorSelector;
