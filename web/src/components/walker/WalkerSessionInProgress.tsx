import React, { useMemo } from 'react';
import type { DoorData } from '../../models/door';
import type { PrintoutData } from '../../models/printout';

export type SessionException =
  | 'gps_lost'
  | 'out_of_range'
  | 'sync_failed'
  | 'no_junk_mail_skipped'
  | 'unknown_eligibility'
  | 'inaccessible'
  | 'wrong_location';

interface WalkerSessionInProgressProps {
  /** Next door to deliver to, or null if none nearby */
  nextDoor: (DoorData & { id: string }) | null;
  /** Distance to next door in meters, or null if not available */
  distanceToNext: number | null;
  /** List of doors already delivered to this session */
  delivered: number;
  /** Total addressable doors in campaign */
  totalDoors: number;
  /** Distance walked in km */
  distanceWalked: number;
  /** Elapsed time in minutes */
  elapsedMinutes: number;
  /** GPS accuracy in meters (for confidence display) */
  gpsAccuracy?: number;
  /** Current exception state, if any */
  exception?: SessionException;
  /** Exception message for display */
  exceptionMessage?: string;
  /** Whether currently syncing with server */
  syncing?: boolean;
  /** Active printout/flyer being delivered */
  activePrintout?: PrintoutData & { id: string };
  /** Callback when user marks door as delivered */
  onDoorDelivered: (doorId: string) => void;
  /** Callback to skip a door */
  onSkipDoor: (doorId: string, reason: string) => void;
  /** Callback to show full door details */
  onShowDoorDetails: (door: DoorData & { id: string }) => void;
  /** Callback to report an issue with a door */
  onReportDoor?: (doorId: string) => void;
}

/**
 * Low-distraction in-session UI focusing on next door to deliver to.
 * Shows exception states (GPS loss, out-of-range, sync failed, policy exclusions) clearly.
 * Mobile-first design with large touch targets and minimal cognitive load.
 */
const WalkerSessionInProgress: React.FC<WalkerSessionInProgressProps> = ({
  nextDoor,
  distanceToNext,
  delivered,
  totalDoors,
  distanceWalked,
  elapsedMinutes,
  gpsAccuracy,
  exception,
  exceptionMessage,
  syncing = false,
  activePrintout,
  onDoorDelivered,
  onSkipDoor,
  onShowDoorDetails,
  onReportDoor,
}) => {
  const deliveryPercent = Math.round((delivered / totalDoors) * 100);
  const avgPaceMin = elapsedMinutes > 0 ? (distanceWalked / elapsedMinutes) * 60 : 0;

  const gpsConfidenceLevel = useMemo(() => {
    if (!gpsAccuracy) return 'unknown';
    if (gpsAccuracy < 10) return 'excellent';
    if (gpsAccuracy < 25) return 'good';
    if (gpsAccuracy < 50) return 'fair';
    return 'poor';
  }, [gpsAccuracy]);

  const exceptionUI = useMemo(() => {
    if (!exception) return null;

    const exceptionConfigs: Record<
      string,
      { color: string; icon: string; title: string; defaultMsg: string; retryable: boolean }
    > = {
      gps_lost: {
        color: 'red',
        icon: '📍',
        title: 'GPS signal lost',
        defaultMsg: 'Waiting for location fix. Auto-delivery paused.',
        retryable: true,
      },
      out_of_range: {
        color: 'amber',
        icon: '⚠️',
        title: 'Out of delivery range',
        defaultMsg: 'Walk closer to nearby doors to continue delivery.',
        retryable: true,
      },
      sync_failed: {
        color: 'amber',
        icon: '🔄',
        title: 'Connection issue',
        defaultMsg: 'Reconnecting to server. Your deliveries are saved locally.',
        retryable: true,
      },
      no_junk_mail_skipped: {
        color: 'blue',
        icon: 'ℹ️',
        title: 'No Junk Mail',
        defaultMsg: 'This address has requested no unsolicited mail.',
        retryable: false,
      },
      unknown_eligibility: {
        color: 'blue',
        icon: 'ℹ️',
        title: 'Property type unknown',
        defaultMsg: 'Verify eligibility before delivering.',
        retryable: false,
      },
      inaccessible: {
        color: 'amber',
        icon: '🔒',
        title: 'Inaccessible address',
        defaultMsg: 'Cannot access this location. Consider reporting.',
        retryable: false,
      },
      wrong_location: {
        color: 'amber',
        icon: '📍',
        title: 'Location mismatch',
        defaultMsg: 'Address location seems incorrect. Please verify.',
        retryable: false,
      },
    };

    const config = exceptionConfigs[exception];
    if (!config) return null;

    const bgColor = {
      red: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60',
      amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60',
      blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60',
    }[config.color];

    const textColor = {
      red: 'text-red-900 dark:text-red-100',
      amber: 'text-amber-900 dark:text-amber-100',
      blue: 'text-blue-900 dark:text-blue-100',
    }[config.color];

    return (
      <div className={`rounded-lg border ${bgColor} p-4`}>
        <div className="flex gap-3">
          <span className="text-2xl flex-shrink-0">{config.icon}</span>
          <div className="flex-1">
            <p className={`font-semibold ${textColor}`}>{config.title}</p>
            <p className={`mt-1 text-sm ${textColor}`}>
              {exceptionMessage || config.defaultMsg}
            </p>
            {config.retryable && (
              <p className={`mt-2 text-xs ${textColor} opacity-75`}>
                Move to a different location or check your connection and retry.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }, [exception, exceptionMessage]);

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      {/* Compact header with progress */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-emerald-100">Delivery Progress</p>
            <p className="text-2xl font-bold">{delivered}</p>
          </div>
          <div className="flex-1">
            <div className="relative h-2 overflow-hidden rounded-full bg-emerald-500">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${deliveryPercent}%` }}
              />
            </div>
            <p className="mt-1 text-right text-xs text-emerald-100">
              {deliveryPercent}% ({totalDoors} total)
            </p>
          </div>
        </div>

        {/* GPS Confidence indicator */}
        {gpsAccuracy !== undefined && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs font-medium text-emerald-100">GPS:</span>
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${
                gpsConfidenceLevel === 'excellent' ? 'bg-white' :
                gpsConfidenceLevel === 'good' ? 'bg-emerald-100' :
                gpsConfidenceLevel === 'fair' ? 'bg-yellow-200' :
                'bg-red-200'
              }`} />
              <span className="text-xs text-emerald-100">
                {gpsConfidenceLevel === 'excellent' ? '±' + Math.round(gpsAccuracy) + 'm (excellent)' :
                 gpsConfidenceLevel === 'good' ? '±' + Math.round(gpsAccuracy) + 'm (good)' :
                 gpsConfidenceLevel === 'fair' ? '±' + Math.round(gpsAccuracy) + 'm (fair)' :
                 '±' + Math.round(gpsAccuracy) + 'm (poor)'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Active flyer reference panel */}
      {activePrintout && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border-b border-emerald-200 dark:border-emerald-800 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xl">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 uppercase">Active Flyer</p>
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100 truncate">
                {activePrintout.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Exception state */}
      {exceptionUI && <div className="px-4 py-3">{exceptionUI}</div>}

      {/* Main next-door focus area */}
      <div className="flex-1 px-4 py-6">
        {nextDoor ? (
          <div className="space-y-4">
            {/* Distance indicator */}
            {distanceToNext !== null && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <p className="text-center text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-400">
                  Distance
                </p>
                <p className="mt-1 text-center text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                  {distanceToNext < 100
                    ? `${distanceToNext}m`
                    : `${(distanceToNext / 1000).toFixed(2)}km`}
                </p>
              </div>
            )}

            {/* Next door card */}
            <div className="rounded-lg border-2 border-emerald-400 bg-emerald-50 p-6 dark:border-emerald-600 dark:bg-emerald-950/20">
              <p className="text-sm font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Next Door
              </p>
              <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-gray-100">
                {nextDoor.houseNumber && `${nextDoor.houseNumber} `}
                {nextDoor.streetName || 'Unknown'}
              </h2>
              {nextDoor.address && (
                <p className="mt-2 text-lg text-gray-700 dark:text-gray-300">
                  {nextDoor.address}
                </p>
              )}

              {/* Door status indicators */}
              <div className="mt-4 flex flex-wrap gap-2">
                {nextDoor.status === 'pending' && (
                  <span className="rounded-full bg-gray-200 px-3 py-1 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    Pending
                  </span>
                )}
                {nextDoor.deliveryCount && nextDoor.deliveryCount > 0 && (
                  <span className="rounded-full bg-green-200 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300">
                    Delivered {nextDoor.deliveryCount}x
                  </span>
                )}
              </div>
            </div>

            {/* Primary action: mark delivered */}
            <button
              onClick={() => onDoorDelivered(nextDoor.id)}
              disabled={syncing}
              className="w-full rounded-lg bg-emerald-600 px-6 py-4 text-lg font-bold text-white transition hover:bg-emerald-700 disabled:bg-gray-400"
            >
              {syncing ? '✓ Syncing...' : '✓ Delivered'}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center space-y-4 py-12 text-center">
            <div className="text-5xl">🗺️</div>
            <div>
              <p className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                No nearby doors
              </p>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                Walk closer to the next address to start delivery.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Secondary actions and stats */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
        {/* Stats row */}
        <div className="mb-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Distance</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
              {distanceWalked.toFixed(2)}km
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Time</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
              {elapsedMinutes}m
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600 dark:text-gray-400">Pace</p>
            <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">
              {avgPaceMin.toFixed(1)}km/h
            </p>
          </div>
        </div>

        {/* Secondary buttons */}
        <div className="flex gap-2">
          {nextDoor && (
            <>
              <button
                onClick={() => onSkipDoor(nextDoor.id, 'user-skip')}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label={`Skip ${nextDoor.address}`}
              >
                Skip
              </button>
              {onReportDoor && (
                <button
                  onClick={() => onReportDoor(nextDoor.id)}
                  className="flex-1 rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-600 dark:text-amber-300 dark:hover:bg-amber-900/20"
                  aria-label={`Report issue at ${nextDoor.address}`}
                >
                  Report
                </button>
              )}
              <button
                onClick={() => onShowDoorDetails(nextDoor)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                aria-label={`Details for ${nextDoor.address}`}
              >
                Details
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalkerSessionInProgress;
