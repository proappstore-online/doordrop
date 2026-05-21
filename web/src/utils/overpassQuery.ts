export type OverpassAddress = {
  houseNumber: string;
  street: string;
  lat: number;
  lng: number;
  commercial?: boolean;
  businessType?: string;
  businessCategory?: string;
};

/**
 * Query the Overpass API for house numbers on a given street near a location.
 * Uses a bounding box around the provided lat/lng (roughly 1km radius).
 */
export async function fetchAddressesOnStreet(
  streetName: string,
  lat: number,
  lng: number,
): Promise<OverpassAddress[]> {
  const delta = 0.01; // ~1km
  const south = lat - delta;
  const north = lat + delta;
  const west = lng - delta;
  const east = lng + delta;

  const query = `
    [out:json][timeout:10];
    (
      node["addr:housenumber"]["addr:street"~"${escapeOverpass(streetName)}",i](${south},${west},${north},${east});
      way["addr:housenumber"]["addr:street"~"${escapeOverpass(streetName)}",i](${south},${west},${north},${east});
    );
    out center;
  `;

  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!res.ok) throw new Error(`Overpass API error: ${res.status}`);

  const data = await res.json();

  const addresses: OverpassAddress[] = [];
  const seen = new Set<string>();

  for (const el of data.elements) {
    const hn = el.tags?.["addr:housenumber"];
    const street = el.tags?.["addr:street"];
    if (!hn || !street) continue;

    const elLat = el.lat ?? el.center?.lat;
    const elLng = el.lon ?? el.center?.lon;
    if (elLat == null || elLng == null) continue;

    if (seen.has(hn)) continue;
    seen.add(hn);

    const commercial = isCommercial(el.tags);
    const biz = classifyBusiness(el.tags);
    addresses.push({ houseNumber: hn, street, lat: elLat, lng: elLng, commercial, ...biz });
  }

  addresses.sort((a, b) => {
    const na = parseInt(a.houseNumber, 10);
    const nb = parseInt(b.houseNumber, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
    return a.houseNumber.localeCompare(b.houseNumber);
  });

  return addresses;
}

const BUSINESS_CATEGORIES: Record<string, string[]> = {
  health: ["doctor", "doctors", "dentist", "clinic", "pharmacy", "physiotherapist", "veterinary", "optometrist", "hospital"],
  food: ["restaurant", "cafe", "fast_food", "bar", "pub", "bakery", "butcher", "deli"],
  retail: ["supermarket", "convenience", "clothes", "hairdresser", "beauty", "electronics", "furniture", "florist"],
  office: ["lawyer", "accountant", "insurance", "estate_agent", "bank", "post_office", "financial"],
  trade: ["plumber", "electrician", "carpenter", "mechanic", "car_wash", "car_rental", "fuel"],
};

const TYPE_TO_CATEGORY = new Map<string, string>();
for (const [category, types] of Object.entries(BUSINESS_CATEGORIES)) {
  for (const type of types) {
    TYPE_TO_CATEGORY.set(type, category);
  }
}

const BUSINESS_TAG_KEYS = ["amenity", "shop", "office", "healthcare", "craft"] as const;

function classifyBusiness(
  tags: Record<string, string> | undefined,
): { businessType: string; businessCategory: string } | undefined {
  if (!tags) return undefined;
  for (const key of BUSINESS_TAG_KEYS) {
    const value = tags[key];
    if (!value) continue;
    const category = TYPE_TO_CATEGORY.get(value);
    if (category) return { businessType: value, businessCategory: category };
  }
  return undefined;
}

const COMMERCIAL_AMENITIES = new Set([
  "restaurant", "cafe", "fast_food", "bar", "pub", "bank", "pharmacy",
  "clinic", "dentist", "doctors", "veterinary", "fuel", "car_wash",
  "car_rental", "nightclub", "casino", "cinema", "theatre",
]);

function isCommercial(tags: Record<string, string> | undefined): boolean {
  if (!tags) return false;
  if (tags["shop"]) return true;
  if (tags["office"]) return true;
  if (tags["amenity"] && COMMERCIAL_AMENITIES.has(tags["amenity"])) return true;
  return false;
}

function escapeOverpass(s: string): string {
  // Whitelist: letters, digits, spaces, hyphens, apostrophes only
  return s.replace(/[^a-zA-Z0-9\s\-']/g, "");
}
