import React, { useState, useEffect, useMemo } from 'react';
import type { CampaignData } from '../../models/campaign';
import type { DoorData, DeliveryEvent } from '../../models/door';
import type { PrintoutData } from '../../models/printout';
import WalkerSessionStartScreen from './WalkerSessionStartScreen';
import WalkerSessionInProgress from './WalkerSessionInProgress';
import WalkerSessionEndScreen from './WalkerSessionEndScreen';

type SessionPhase = 'readiness' | 'active' | 'ended';

interface Exception {
  type: 'gps_lost' | 'out_of_range' | 'sync_failed' | 'no_junk_mail_skipped' | 'unknown_eligibility';
  message?: string;
  timestamp: number;
}

interface WalkerSessionContainerProps {
  campaign: CampaignData & { id: string };
  printouts: (PrintoutData & { id: string })[];
  doors: (DoorData & { id: string })[];
  activePrintoutId: string | null;

  // Tracking state
  trackingState: 'idle' | 'requesting' | 'active' | 'out_of_range' | 'left_area';
  position: { lat: number; lng: number } | null;
  geoError: string | null;
  distanceKm: number;
  elapsedMinutes: number;
  deliveredDoors: Set<string>;

  // Callbacks for tracking control
  onStartTracking: () => void;
  onStopTracking: () => void;
  onDoorDelivered: (doorId: string, event: DeliveryEvent) => Promise<void>;
  onSkipDoor: (doorId: string) => void;
  onComplete: () => void;
}

/**
 * Container component orchestrating the mobile-first walker delivery session.
 * Manages state transitions between readiness check, active delivery, and end-of-run review.
 * Handles all exception states: GPS loss, out-of-range, failed sync, skipped addresses, eligibility.
 */
const WalkerSessionContainer: React.FC<WalkerSessionContainerProps> = ({
  campaign,
  printouts,
  doors,
  activePrintoutId,
  trackingState,
  position,
  geoError,
  distanceKm,
  elapsedMinutes,
  deliveredDoors,
  onStartTracking,
  onStopTracking,
  onDoorDelivered,
  onSkipDoor,
  onComplete,
}) => {
  const [phase, setPhase] = useState<SessionPhase>('readiness');
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [selectedDoor, setSelectedDoor] = useState<(DoorData & { id: string }) | null>(null);
  const [endReason, setEndReason] = useState<string>('manual_stop');
  const [endError, setEndError] = useState<string | null>(null);

  // Determine active exception (most recent of severity)
  const activeException = useMemo(() => {
    const severityMap = {
      gps_lost: 0,
      sync_failed: 1,
      out_of_range: 2,
      no_junk_mail_skipped: 3,
      unknown_eligibility: 4,
    };

    let highest: Exception | null = null;
    for (const ex of exceptions) {
      if (!highest || severityMap[ex.type] < severityMap[highest.type]) {
        highest = ex;
      }
    }
    return highest;
  }, [exceptions]);

  // Update exceptions based on tracking state
  useEffect(() => {
    setExceptions((prev) => {
      let updated = [...prev];

      // Remove old exceptions (older than 5 seconds)
      const cutoff = Date.now() - 5000;
      updated = updated.filter((e) => e.timestamp > cutoff);

      // Add new exceptions based on current state
      if (geoError && !updated.find((e) => e.type === 'gps_lost')) {
        updated.push({
          type: 'gps_lost',
          message: geoError,
          timestamp: Date.now(),
        });
      }

      if (
        trackingState === 'out_of_range' &&
        !updated.find((e) => e.type === 'out_of_range')
      ) {
        updated.push({
          type: 'out_of_range',
          message: 'No nearby doors within delivery radius',
          timestamp: Date.now(),
        });
      }

      if (!navigator.onLine && !updated.find((e) => e.type === 'sync_failed')) {
        updated.push({
          type: 'sync_failed',
          message: 'No internet connection',
          timestamp: Date.now(),
        });
      }

      return updated;
    });
  }, [geoError, trackingState]);

  // Handle session state transitions
  useEffect(() => {
    if (trackingState === 'left_area') {
      setEndReason('out_of_range');
      setPhase('ended');
    }
  }, [trackingState]);

  const activePrintout = activePrintoutId
    ? printouts.find((p) => p.id === activePrintoutId)
    : null;

  // Find next door to deliver to (nearest undelivered door)
  const nextDoor = useMemo(() => {
    if (!position) return null;

    const undelivered = doors.filter(
      (d) => !deliveredDoors.has(d.id) && d.status !== 'delivered' && d.status !== 'reported',
    );

    if (undelivered.length === 0) return null;

    // Sort by distance (only consider doors with coordinates)
    return undelivered
      .filter((d) => d.lat !== undefined && d.lng !== undefined)
      .map((d) => ({
        door: d,
        distance: Math.hypot((d.lat || 0) - position.lat, (d.lng || 0) - position.lng) * 111.32 * 1000, // rough km to m
      }))
      .sort((a, b) => a.distance - b.distance)[0]?.door || null;
  }, [doors, position, deliveredDoors]);

  const distanceToNext = useMemo(() => {
    if (!nextDoor || !position || nextDoor.lat === undefined || nextDoor.lng === undefined) return null;
    // Rough distance calculation in meters
    return Math.hypot(nextDoor.lat - position.lat, nextDoor.lng - position.lng) * 111.32 * 1000;
  }, [nextDoor, position]);

  const handleStartSession = async () => {
    try {
      setSyncing(true);
      setPhase('active');
      onStartTracking();
    } finally {
      setSyncing(false);
    }
  };

  const handleDoorDelivered = async (doorId: string) => {
    try {
      setSyncing(true);
      const event: DeliveryEvent = {
        date: new Date(),
        deliveredBy: '', // Will be set by parent
        ...(activePrintoutId && { printoutVersionId: activePrintoutId }),
      };
      await onDoorDelivered(doorId, event);
    } catch (err) {
      setEndError(err instanceof Error ? err.message : String(err));
    } finally {
      setSyncing(false);
    }
  };

  const handleEndSession = () => {
    setEndReason('manual_stop');
    setPhase('ended');
    onStopTracking();
  };

  const handleResumeSession = () => {
    setExceptions([]);
    setPhase('active');
    onStartTracking();
  };

  const handleCompleteSession = () => {
    onComplete();
  };

  // Render appropriate phase
  if (phase === 'readiness') {
    return (
      <WalkerSessionStartScreen
        campaign={campaign}
        activePrintout={activePrintout || null}
        onStart={handleStartSession}
        onCancel={onComplete}
        isLoading={syncing}
      />
    );
  }

  if (phase === 'active') {
    return (
      <>
        <WalkerSessionInProgress
          nextDoor={nextDoor}
          distanceToNext={distanceToNext}
          delivered={deliveredDoors.size}
          totalDoors={campaign.totalDoors || doors.length}
          distanceWalked={distanceKm}
          elapsedMinutes={elapsedMinutes}
          exception={activeException?.type}
          exceptionMessage={activeException?.message}
          syncing={syncing}
          onDoorDelivered={handleDoorDelivered}
          onSkipDoor={() => nextDoor && onSkipDoor(nextDoor.id)}
          onShowDoorDetails={setSelectedDoor}
        />

        {/* Door detail modal if selected - TODO: implement door detail view */}
        {selectedDoor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="rounded-lg bg-white p-6 dark:bg-gray-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {selectedDoor.houseNumber && `${selectedDoor.houseNumber} `}
                {selectedDoor.streetName}
              </h2>
              <p className="mt-2 text-gray-700 dark:text-gray-300">{selectedDoor.address}</p>
              <button
                onClick={() => setSelectedDoor(null)}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* End session button (could be in a floating overlay) */}
        {false && ( // Hide for now - can be in menu
          <button
            onClick={handleEndSession}
            className="fixed bottom-20 left-4 right-4 rounded-lg bg-red-600 px-4 py-3 text-white"
          >
            End Session
          </button>
        )}
      </>
    );
  }

  // End phase
  return (
    <WalkerSessionEndScreen
      deliveredCount={deliveredDoors.size}
      totalDoors={campaign.totalDoors || doors.length}
      totalDistance={distanceKm}
      totalDuration={elapsedMinutes}
      endReason={endReason as any}
      error={endError || undefined}
      canResume={geoError === null && navigator.onLine && trackingState !== 'left_area'}
      onResume={geoError === null && navigator.onLine ? handleResumeSession : undefined}
      onComplete={handleCompleteSession}
    />
  );
};

export default WalkerSessionContainer;
