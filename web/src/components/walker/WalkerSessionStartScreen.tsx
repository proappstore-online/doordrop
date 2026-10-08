import React, { useEffect, useState } from 'react';
import type { CampaignData } from '../../models/campaign';
import type { PrintoutData } from '../../models/printout';

interface WalkerSessionStartScreenProps {
  campaign: CampaignData & { id: string };
  activePrintout: PrintoutData & { id: string } | null;
  onStart: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface ReadinessCheck {
  geoLocation: boolean;
  geoReason?: string;
  network: boolean;
  networkReason?: string;
  battery: boolean;
  batteryPercent?: number;
  activePrintout: boolean;
  activePrintoutReason?: string;
}

/**
 * Mobile-first start readiness screen for walkers.
 * Displays permissions, battery/network status, active flyer, and route context before delivery starts.
 * Provides clear blocking/warning messages and actionable guidance.
 */
const WalkerSessionStartScreen: React.FC<WalkerSessionStartScreenProps> = ({
  campaign,
  activePrintout,
  onStart,
  onCancel,
  isLoading = false,
}) => {
  const [readiness, setReadiness] = useState<ReadinessCheck>({
    geoLocation: false,
    network: true,
    battery: true,
    activePrintout: !!activePrintout,
  });

  // Check geolocation permission
  useEffect(() => {
    const checkGeo = async () => {
      try {
        if (!('geolocation' in navigator)) {
          setReadiness((prev) => ({
            ...prev,
            geoLocation: false,
            geoReason: 'Geolocation not supported',
          }));
          return;
        }

        navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          setReadiness((prev) => ({
            ...prev,
            geoLocation: result.state === 'granted',
            geoReason:
              result.state === 'denied'
                ? 'Location permission denied. Enable in settings and reload.'
                : result.state === 'prompt'
                  ? 'Location permission required'
                  : undefined,
          }));
        });
      } catch (err) {
        // Fallback: permission query not supported, will request at tracking start
        setReadiness((prev) => ({ ...prev, geoLocation: true }));
      }
    };

    checkGeo();
  }, []);

  // Check network status
  useEffect(() => {
    const updateNetworkStatus = () => {
      const online = navigator.onLine;
      setReadiness((prev) => ({
        ...prev,
        network: online,
        networkReason: online ? undefined : 'No internet connection',
      }));
    };

    updateNetworkStatus();
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  // Check battery status
  useEffect(() => {
    const checkBattery = async () => {
      try {
        if ('getBattery' in navigator) {
          const battery = await (navigator as any).getBattery();
          const batteryPercent = Math.round(battery.level * 100);
          setReadiness((prev) => ({
            ...prev,
            battery: batteryPercent > 20,
            batteryPercent,
          }));
        } else if ('BatteryManager' in window) {
          // Fallback for older APIs
          setReadiness((prev) => ({ ...prev, battery: true }));
        }
      } catch (err) {
        // Battery API not available, assume good
        setReadiness((prev) => ({ ...prev, battery: true }));
      }
    };

    checkBattery();
  }, []);

  const canStart =
    readiness.geoLocation && readiness.network && readiness.battery && readiness.activePrintout;
  const hasWarnings = !readiness.battery || !readiness.network;

  const CheckItem: React.FC<{ ok: boolean; warning?: boolean; label: string; reason?: string }> = ({
    ok,
    warning,
    label,
    reason,
  }) => (
    <div className={`rounded-lg border p-4 ${ok ? 'border-green-200 bg-green-50 dark:border-green-900/60 dark:bg-green-950/20' : warning ? 'border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20' : 'border-red-200 bg-red-50 dark:border-red-900/60 dark:bg-red-950/20'}`}>
      <div className="flex items-center gap-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold text-white" style={{
          backgroundColor: ok ? '#16a34a' : warning ? '#d97706' : '#dc2626',
        }}>
          {ok ? '✓' : warning ? '⚠' : '✗'}
        </div>
        <div className="flex-1">
          <p className="font-medium text-gray-900 dark:text-gray-100">{label}</p>
          {reason && (
            <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{reason}</p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-b from-emerald-600 to-emerald-700 px-4 py-6 text-white">
        <h1 className="text-2xl font-bold">Ready to deliver?</h1>
        <p className="mt-2 text-emerald-100">
          {campaign.suburb} {campaign.postcode}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-6">
        {/* Campaign Info */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Campaign</p>
          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
            {campaign.name}
          </p>
          <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
            {campaign.totalDoors} doors • {campaign.doorRadiusM}m radius
          </p>
        </div>

        {/* Active Flyer */}
        <CheckItem
          ok={readiness.activePrintout}
          label="Flyer selected"
          reason={
            readiness.activePrintout
              ? `Using: ${activePrintout?.name || 'Unnamed'}`
              : 'No flyer selected. Choose one before starting.'
          }
        />

        {/* Readiness Checks */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Device readiness</p>
          <CheckItem
            ok={readiness.geoLocation}
            label="Location access"
            reason={readiness.geoReason}
          />
          <CheckItem
            ok={readiness.network}
            warning={!readiness.network}
            label="Internet connection"
            reason={readiness.networkReason}
          />
          <CheckItem
            ok={readiness.battery}
            warning={!readiness.battery && (readiness.batteryPercent || 0) > 10}
            label="Battery level"
            reason={
              readiness.batteryPercent
                ? `${readiness.batteryPercent}% — ${readiness.battery ? 'Good' : 'Low'}`
                : undefined
            }
          />
        </div>

        {/* Warnings */}
        {hasWarnings && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              ⚠ Delivery will be challenging with these conditions. Proceed with caution.
            </p>
          </div>
        )}

        {/* Blocked reasons */}
        {!canStart && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
            <p className="text-sm font-medium text-red-900 dark:text-red-100">
              Fix the issues above before you can start delivering.
            </p>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-700 dark:bg-gray-800">
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={onStart}
            disabled={!canStart || isLoading}
            className={`flex-1 rounded-lg px-4 py-3 font-medium text-white transition ${
              canStart
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'cursor-not-allowed bg-gray-400'
            } disabled:opacity-50`}
          >
            {isLoading ? 'Starting...' : 'Start Delivery'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WalkerSessionStartScreen;
