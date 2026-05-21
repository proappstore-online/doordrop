export interface AustralianSuburb {
  suburb: string;
  postcode: string;
  state: string;
}

interface PostcodeApiResult {
  name: string;
  postcode: number;
  state: { name: string; abbreviation: string };
  latitude: number;
  longitude: number;
}

export async function searchSuburbs(query: string, limit: number = 10): Promise<AustralianSuburb[]> {
  const q = query.trim();
  if (!q) return [];

  const res = await fetch(
    `https://v0.postcodeapi.com.au/suburbs.json?q=${encodeURIComponent(q)}`
  );
  if (!res.ok) return [];

  const data: PostcodeApiResult[] = await res.json();

  return data.slice(0, limit).map((item) => ({
    suburb: item.name,
    postcode: String(item.postcode).padStart(4, "0"),
    state: item.state.name,
  }));
}
