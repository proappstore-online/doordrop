export interface TrackingDebugInfo {
  callbackRegistered: boolean;
  nearbyDoorsDetected: number;
  deliveryAttempts: number;
  deliveryErrors: string[];
  sessionCreationError?: string;
  lastGeofenceCheck?: string;
  currentSpeedMs?: number;
  isWalkingPace?: boolean;
}
