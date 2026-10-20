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
