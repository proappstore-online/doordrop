import React, { useState } from 'react';
import type { ReadinessState } from './DeliveryReadinessCheck';
import DeliveryReadinessCheck from './DeliveryReadinessCheck';

interface DeliveryStartupScreenProps {
  campaignName: string;
  doorRadius?: number;
  hasFlyer: boolean;
  doorCount: number;
  isCampaignClosed: boolean;
  onStartDelivery: () => void;
}

function getStateConfig(doorRadius?: number): Record<ReadinessState, { icon: string; title: string; message: string; guidance: string; recoveryAction?: string }> {
  return {
    checking: {
      icon: '⏳',
      title: 'Checking readiness...',
      message: 'We\'re verifying permissions and location...',
      guidance: 'Please wait while we check your location and network connection.',
    },
    ready: {
      icon: '✓',
      title: 'Ready to deliver!',
      message: 'Everything is set up.',
      guidance: 'Tap "Start Delivery" to begin.',
    },
    'permission-denied': {
      icon: '🔒',
      title: 'Location permission needed',
      message: 'We need access to your location to track your delivery route.',
      guidance: 'Please grant location permission in your device settings, then tap "Retry".',
      recoveryAction: 'Retry',
    },
    'inaccurate-gps': {
      icon: '📍',
      title: 'GPS signal weak',
      message: 'Your location signal is not accurate enough to start.',
      guidance: 'Move to an open area away from buildings and try again. Accuracy should be better than 50 meters.',
      recoveryAction: 'Retry',
    },
    offline: {
      icon: '📡',
      title: 'No internet connection',
      message: 'You need an internet connection to start a delivery.',
      guidance: 'Please connect to WiFi or mobile data, then tap "Retry".',
      recoveryAction: 'Retry',
    },
    'out-of-range': {
      icon: '📍',
      title: 'Outside delivery area',
      message: doorRadius ? `You're not within the ${doorRadius}m delivery radius to start.` : 'You\'re outside the delivery area.',
      guidance: 'Please move to a location within the delivery area and try again.',
      recoveryAction: 'Retry',
    },
    'no-flyer': {
      icon: '📄',
      title: 'No active flyer',
      message: 'This campaign doesn\'t have an active flyer to deliver.',
      guidance: 'Contact the campaign admin to set up the flyer before starting delivery.',
    },
    'no-doors': {
      icon: '🚪',
      title: 'No delivery locations',
      message: 'There are no doors to deliver to in this campaign.',
      guidance: 'Ask the campaign admin to add delivery locations.',
    },
    'campaign-closed': {
      icon: '⛔',
      title: 'Campaign closed',
      message: 'This campaign is no longer accepting deliveries.',
      guidance: 'You cannot start a delivery for a closed campaign.',
    },
    'failed-session': {
      icon: '❌',
      title: 'Session failed to start',
      message: 'We couldn\'t create a delivery session on the server.',
      guidance: 'Please check your connection and try again. If this persists, contact support.',
      recoveryAction: 'Retry',
    },
  } as const;
}

const DeliveryStartupScreen: React.FC<DeliveryStartupScreenProps> = ({
  campaignName,
  doorRadius,
  hasFlyer,
  doorCount,
  isCampaignClosed,
  onStartDelivery,
}) => {
  const [state, setState] = useState<ReadinessState>('checking');
  const [isRetrying, setIsRetrying] = useState(false);

  const stateConfig = getStateConfig(doorRadius);
  const config = stateConfig[state as keyof typeof stateConfig];
  const isReady = state === 'ready';
  const canRetry = !!config.recoveryAction;

  const handleRetry = () => {
    setIsRetrying(true);
    setState('checking');
    setTimeout(() => setIsRetrying(false), 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <DeliveryReadinessCheck
        hasFlyer={hasFlyer}
        doorCount={doorCount}
        isCampaignClosed={isCampaignClosed}
        onReady={onStartDelivery}
        onStateChange={(newState) => {
          setState(newState);
          setIsRetrying(false);
        }}
      />

      <div className="max-w-sm w-full space-y-6 text-center">
        {/* Icon */}
        <div className="text-6xl">{config.icon}</div>

        {/* Campaign name */}
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">{campaignName}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {doorCount} doors • {doorRadius}m radius • {hasFlyer ? '✓ Flyer' : '✗ No flyer'}
          </p>
        </div>

        {/* Status message */}
        <div className="space-y-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{config.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{config.message}</p>
        </div>

        {/* Guidance */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">{config.guidance}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 pt-4">
          {isReady && (
            <button
              onClick={onStartDelivery}
              className="h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg transition-colors"
              aria-label="Start delivery"
            >
              Start Delivery
            </button>
          )}

          {canRetry && config.recoveryAction && (
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="h-12 px-6 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              aria-label={config.recoveryAction}
            >
              {isRetrying ? '...' : config.recoveryAction}
            </button>
          )}

          {!isReady && !canRetry && (
            <p className="text-xs text-gray-500 dark:text-gray-400 pt-4">
              Contact campaign admin to resolve this issue.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default DeliveryStartupScreen;
