// Stub. The real implementation (606 LOC: state machine, geofence, Douglas-
// Peucker, walking-pace, localStorage resume) is being ported to Worker writes
// in task #9. Importers compile against this surface in the meantime.

import type { DoorData } from '../models/door';
import type { TrackPoint, TrackStop } from '../models/campaign';

export type PersistedSession = {
  campaignId: string;
  sessionId: string;
  walkerId: string;
  startedAt: number;
  doorRadiusM: number;
};

export function getPersistedSession(): PersistedSession | null {
  return null;
}

export function useDeliveryTracking() {
  return {
    state: 'idle' as 'idle' | 'requesting' | 'active' | 'out_of_range' | 'left_area',
    position: null as { lat: number; lng: number } | null,
    geoError: null as string | null,
    requesting: false,
    distanceKm: 0,
    elapsedMinutes: 0,
    startTracking: async (
      _doors: (DoorData & { id?: string })[],
      _campaignId?: string,
      _walkerId?: string,
      _doorRadiusM?: number,
      _onDoorVisited?: (doorId: string) => void,
    ) => {
      throw new Error('useDeliveryTracking: not yet ported (task #9)');
    },
    resumeTracking: (
      _doors: (DoorData & { id?: string })[],
      _session: PersistedSession,
      _onDoorVisited?: (doorId: string) => void,
    ) => {
      throw new Error('useDeliveryTracking.resumeTracking: not yet ported (task #9)');
    },
    stopTracking: () => ({ distanceKm: 0, durationMinutes: 0 }),
    dismissError: () => {},
    trackPoints: [] as TrackPoint[],
    trackStops: [] as TrackStop[],
    trackSessionId: null as string | null,
    autoStopResult: null as { distanceKm: number; durationMinutes: number } | null,
    debugInfo: {
      callbackRegistered: false,
      nearbyDoorsDetected: 0,
      deliveryAttempts: 0,
      deliveryErrors: [] as string[],
    },
    updateDoorVisitedCallback: (_cb: ((doorId: string) => void) | null) => {},
  };
}
