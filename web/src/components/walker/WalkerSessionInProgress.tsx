import React, { useMemo } from 'react';
import type { DoorData } from '../../models/door';

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
  /** Current exception state, if any */
  exception?: 'gps_lost' | 'out_of_range' | 'sync_failed' | 'no_junk_mail_skipped' | 'unknown_eligibility';
  /** Exception message for display */
  exceptionMessage?: string;
  /** Whether currently syncing with server */
  syncing?: boolean;
  /** Callback when user marks door as delivered */
  onDoorDelivered: (doorId: string) => void;
  /** Callback to skip a door */
  onSkipDoor: () => void;
  /** Callback to show full door details */
  onShowDoorDetails: (door: DoorData & { id: string }) => void;
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
  exception,
  exceptionMessage,
  syncing = false,
  onDoorDelivered,
  onSkipDoor,
  onShowDoorDetails,
}) => {
  const deliveryPercent = Math.round((delivered / totalDoors) * 100);
  const avgPaceMin = elapsedMinutes > 0 ? (distanceWalked / elapsedMinutes) * 60 : 0;

  const exceptionUI = useMemo(() => {
    if (!exception) return null;

    const exceptionConfigs: Record<
      string,
      { color: string; icon: string; title: string; defaultMsg: string }
    > = {
      gps_lost: {
        color: 'red',
        icon: '📍',
        title: 'GPS signal lost',
        defaultMsg: 'Waiting for location fix. Auto-delivery paused.',
      },
      out_of_range: {
        color: 'amber',
        icon: '⚠️',
        title: 'Out of delivery range',
        defaultMsg: 'Walk closer to nearby doors to continue delivery.',
      },
      sync_failed: {
        color: 'amber',
        icon: '🔄',
        title: 'Connection issue',
        defaultMsg: 'Reconnecting to server. Your deliveries are saved locally.',
      },
      no_junk_mail_skipped: {
        color: 'blue',
        icon: 'ℹ️',
        title: 'No Junk Mail',
        defaultMsg: 'This address has requested no unsolicited mail.',
      },
      unknown_eligibility: {
        color: 'blue',
        icon: 'ℹ️',
        title: 'Property type unknown',
        defaultMsg: 'Verify eligibility before delivering.',
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
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className={`font-semibold ${textColor}`}>{config.title}</p>
            <p className={`mt-1 text-sm ${textColor}`}>
              {exceptionMessage || config.defaultMsg}
            </p>
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
      </div>

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
                onClick={onSkipDoor}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Skip
              </button>
              <button
                onClick={() => onShowDoorDetails(nextDoor)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
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
