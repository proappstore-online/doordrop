import simplify from "simplify-js";
import type { TrackPoint } from "../models/campaign";

/**
 * GPS Track Simplification Utility
 *
 * Uses Douglas-Peucker algorithm to reduce GPS points while preserving route shape.
 * Industry standard for delivery/walking tracking.
 */

/**
 * Simplify GPS track points using Douglas-Peucker algorithm
 *
 * @param points - Array of GPS track points
 * @param tolerance - Simplification tolerance in degrees (default: 0.0001 ≈ 10 meters)
 * @param highQuality - Use slower but higher quality algorithm (default: true)
 * @returns Simplified array of track points (typically 70-90% reduction)
 *
 * @example
 * const rawPoints = [...]; // 1000 points from GPS
 * const simplified = simplifyTrack(rawPoints); // ~100-300 points
 */
export function simplifyTrack(
  points: TrackPoint[],
  tolerance: number = 0.0001,
  highQuality: boolean = true
): TrackPoint[] {
  if (points.length <= 2) return points;

  // Convert TrackPoint to simplify-js format
  const simplePoints = points.map((p) => ({ x: p.lng, y: p.lat }));

  // Run Douglas-Peucker simplification
  const simplified = simplify(simplePoints, tolerance, highQuality);

  // Map back to TrackPoint format
  // We need to preserve the timestamp from original points
  return simplified.map((sp) => {
    // Find closest original point to maintain timestamp accuracy
    const original = points.find((p) => p.lng === sp.x && p.lat === sp.y);
    return original || { lat: sp.y, lng: sp.x, t: Date.now() };
  });
}

/**
 * Check if a new point should be added to the track
 * Filters out points that are too close to the previous point
 *
 * @param newPoint - New GPS point
 * @param lastPoint - Last saved GPS point
 * @param minDistanceMeters - Minimum distance in meters (default: 5)
 * @returns true if point should be saved
 */
export function shouldSavePoint(
  newPoint: { lat: number; lng: number },
  lastPoint: { lat: number; lng: number } | null,
  minDistanceMeters: number = 5
): boolean {
  if (!lastPoint) return true;

  const distance = haversineDistance(
    lastPoint.lat,
    lastPoint.lng,
    newPoint.lat,
    newPoint.lng
  );

  return distance >= minDistanceMeters;
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 *
 * @param lat1 - First point latitude
 * @param lng1 - First point longitude
 * @param lat2 - Second point latitude
 * @param lng2 - Second point longitude
 * @returns Distance in meters
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate total distance of a GPS track
 *
 * @param points - Array of GPS points
 * @returns Total distance in kilometers
 */
export function calculateTrackDistance(points: TrackPoint[]): number {
  if (points.length < 2) return 0;

  let totalMeters = 0;
  for (let i = 1; i < points.length; i++) {
    totalMeters += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng
    );
  }

  return totalMeters / 1000; // Convert to km
}

/**
 * Simplification stats for debugging
 */
export function getSimplificationStats(
  original: TrackPoint[],
  simplified: TrackPoint[]
): {
  originalCount: number;
  simplifiedCount: number;
  reductionPercent: number;
  pointsSaved: number;
} {
  const originalCount = original.length;
  const simplifiedCount = simplified.length;
  const pointsSaved = originalCount - simplifiedCount;
  const reductionPercent = ((pointsSaved / originalCount) * 100);

  return {
    originalCount,
    simplifiedCount,
    reductionPercent,
    pointsSaved,
  };
}

/**
 * Industry best practices for GPS tracking:
 *
 * 1. **Tolerance levels by use case:**
 *    - Walking/delivery: 0.0001° (~10m) - Recommended
 *    - Cycling: 0.0002° (~20m)
 *    - Driving: 0.0005° (~50m)
 *
 * 2. **When to simplify:**
 *    - Before saving to Firestore (not real-time display)
 *    - When buffer reaches 50-100 points
 *    - On tracking stop/pause
 *
 * 3. **Expected results:**
 *    - Typical reduction: 70-90% fewer points
 *    - Visual accuracy: <1% route shape difference
 *    - Storage savings: 10x reduction in Firestore costs
 *
 * 4. **Performance:**
 *    - simplify-js: ~1ms for 1000 points
 *    - High quality mode: ~2-3ms for 1000 points
 */
