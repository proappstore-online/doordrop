import React, { useMemo } from 'react';

interface WalkerSessionEndScreenProps {
  /** Number of doors successfully delivered */
  deliveredCount: number;
  /** Total addressable doors */
  totalDoors: number;
  /** Total distance walked in km */
  totalDistance: number;
  /** Total duration in minutes */
  totalDuration: number;
  /** Reason session ended */
  endReason:
    | 'manual_stop'
    | 'out_of_range'
    | 'gps_lost'
    | 'connection_lost'
    | 'app_closed';
  /** Any error/exception that occurred */
  error?: string;
  /** Callback to resume delivery if possible */
  onResume?: () => void;
  /** Callback to end session and return to campaigns list */
  onComplete: () => void;
  /** Whether can resume (connection available, etc) */
  canResume?: boolean;
}

/**
 * End-of-run review and recovery screen.
 * Shows delivery summary, recovery options, and allows user to resume if connection restored.
 * Supports offline-first: displays locally-saved state and syncs when connection returns.
 */
const WalkerSessionEndScreen: React.FC<WalkerSessionEndScreenProps> = ({
  deliveredCount,
  totalDoors,
  totalDistance,
  totalDuration,
  endReason,
  error,
  onResume,
  onComplete,
  canResume = false,
}) => {
  const successRate = Math.round((deliveredCount / totalDoors) * 100);
  const avgPace = totalDuration > 0 ? (totalDistance / totalDuration) * 60 : 0;

  const endReasonConfig = useMemo(() => {
    const configs: Record<
      string,
      {
        icon: string;
        title: string;
        message: string;
        severity: 'success' | 'warning' | 'error';
      }
    > = {
      manual_stop: {
        icon: '✓',
        title: 'Delivery stopped',
        message: 'You manually ended the delivery session.',
        severity: 'success',
      },
      out_of_range: {
        icon: '📍',
        title: 'Out of range',
        message: 'You left the delivery area. Your deliveries are saved.',
        severity: 'warning',
      },
      gps_lost: {
        icon: '⚠️',
        title: 'GPS signal lost',
        message: 'Lost location fix. Move to an open area and try resuming.',
        severity: 'warning',
      },
      connection_lost: {
        icon: '🔄',
        title: 'Connection lost',
        message: 'Internet connection dropped. Deliveries are saved locally.',
        severity: 'warning',
      },
      app_closed: {
        icon: '⚠️',
        title: 'App closed',
        message: 'App was closed or crashed. Your progress is saved.',
        severity: 'warning',
      },
    };

    return configs[endReason] || configs.manual_stop;
  }, [endReason]);

  const bgColor = {
    success: 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/60',
    warning: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60',
    error: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60',
  }[endReasonConfig.severity];

  const textColor = {
    success: 'text-green-900 dark:text-green-100',
    warning: 'text-amber-900 dark:text-amber-100',
    error: 'text-red-900 dark:text-red-100',
  }[endReasonConfig.severity];

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      {/* Header with summary stat */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-8 text-white">
        <p className="text-sm font-medium text-emerald-100">Session complete</p>
        <p className="mt-2 text-5xl font-bold">{deliveredCount}</p>
        <p className="mt-1 text-emerald-100">doors delivered</p>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {/* End reason */}
        <div className={`rounded-lg border ${bgColor} p-4`}>
          <div className="flex gap-3">
            <span className="text-2xl">{endReasonConfig.icon}</span>
            <div>
              <p className={`font-semibold ${textColor}`}>{endReasonConfig.title}</p>
              <p className={`mt-1 text-sm ${textColor}`}>{endReasonConfig.message}</p>
            </div>
          </div>
        </div>

        {/* Error message if any */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">Error details:</p>
            <p className="mt-2 text-sm text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Delivery summary */}
        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Success rate</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {successRate}% ({deliveredCount}/{totalDoors})
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Distance</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {totalDistance.toFixed(2)} km
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700 dark:text-gray-300">Duration</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {totalDuration} minutes
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-200 pt-3 dark:border-gray-700">
            <span className="text-gray-700 dark:text-gray-300">Average pace</span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {avgPace.toFixed(1)} km/h
            </span>
          </div>
        </div>

        {/* Recovery options */}
        {(canResume || endReason === 'connection_lost' || endReason === 'gps_lost') && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
            <p className="font-medium text-blue-900 dark:text-blue-100">Recovery options:</p>
            <ul className="mt-2 space-y-1 text-sm text-blue-800 dark:text-blue-200">
              {endReason === 'gps_lost' && (
                <li>• Move to an open area with clear sky view</li>
              )}
              {endReason === 'connection_lost' && (
                <li>• Check your internet connection and try resuming</li>
              )}
              {endReason === 'out_of_range' && (
                <li>• Return to the delivery area to continue</li>
              )}
              <li>• Your local deliveries are saved and will sync automatically</li>
            </ul>
          </div>
        )}

        {/* Data sync status */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Data sync</p>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            {navigator.onLine
              ? '✓ Connected. Your deliveries are being synced to the server.'
              : '⚠ Offline mode. Changes will sync when you reconnect.'}
          </p>
        </div>
      </div>

      {/* Footer actions */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex flex-col gap-2">
          {onResume && canResume && (
            <button
              onClick={onResume}
              className="w-full rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white transition hover:bg-emerald-700"
            >
              Resume Delivery
            </button>
          )}
          <button
            onClick={onComplete}
            className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkerSessionEndScreen;
