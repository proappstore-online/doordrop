/**
 * Sort doors by their geographic position along a street's principal axis.
 * Falls back to numeric house number sort if fewer than 2 doors have coordinates.
 */
export function sortDoorsAlongStreet<
  T extends { lat?: number; lng?: number; houseNumber: string }
>(doors: T[]): T[] {
  if (doors.length <= 1) return doors;

  // Collect doors that have coordinates
  const withCoords = doors.filter(
    (d): d is T & { lat: number; lng: number } =>
      d.lat != null && d.lng != null
  );

  if (withCoords.length < 2) return sortByHouseNumber(doors);

  // Find the two farthest-apart doors (they define the street axis)
  let maxDist = -1;
  let a = withCoords[0];
  let b = withCoords[1];
  for (let i = 0; i < withCoords.length; i++) {
    for (let j = i + 1; j < withCoords.length; j++) {
      const dlat = withCoords[j].lat - withCoords[i].lat;
      const dlng = withCoords[j].lng - withCoords[i].lng;
      const dist = dlat * dlat + dlng * dlng;
      if (dist > maxDist) {
        maxDist = dist;
        a = withCoords[i];
        b = withCoords[j];
      }
    }
  }

  // Direction vector of the street axis
  const dx = b.lat - a.lat;
  const dy = b.lng - a.lng;

  // Project each door onto the axis; doors without coords get Infinity so they sort last
  const projected = doors.map((door) => {
    if (door.lat == null || door.lng == null) return { door, t: Infinity };
    const t = (door.lat - a.lat) * dx + (door.lng - a.lng) * dy;
    return { door, t };
  });

  projected.sort((x, y) => {
    const diff = x.t - y.t;
    if (diff !== 0) return diff;
    return compareHouseNumber(x.door.houseNumber, y.door.houseNumber);
  });

  return projected.map((p) => p.door);
}

function sortByHouseNumber<T extends { houseNumber: string }>(doors: T[]): T[] {
  return [...doors].sort((a, b) => compareHouseNumber(a.houseNumber, b.houseNumber));
}

function compareHouseNumber(a: string, b: string): number {
  const numA = parseInt(a, 10);
  const numB = parseInt(b, 10);
  if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
  return a.localeCompare(b);
}
