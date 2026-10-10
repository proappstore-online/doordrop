import React from 'react';
import StatusChip from './StatusChip';

export type InterestState =
  | 'available'
  | 'interest-submitted'
  | 'assigned'
  | 'withdrawn'
  | 'unavailable'
  | 'closed';

interface InterestStateIndicatorProps {
  state: InterestState;
  showGuidance?: boolean;
}

const stateConfig: Record<
  InterestState,
  {
    label: string;
    variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'pending' | 'assigned' | 'active' | 'complete';
    guidance: string;
    icon: string;
  }
> = {
  available: {
    label: 'Available',
    variant: 'info',
    guidance: 'Tap "Interest" to express interest and get notified when assigned.',
    icon: '✓',
  },
  'interest-submitted': {
    label: 'Pending',
    variant: 'pending',
    guidance: 'Your interest is pending. The campaign admin will review and assign if you\'re a good fit.',
    icon: '⏳',
  },
  assigned: {
    label: 'Assigned',
    variant: 'assigned',
    guidance: 'You\'re assigned! Tap "Start Delivery" to begin and earn your pay.',
    icon: '✓',
  },
  withdrawn: {
    label: 'Withdrawn',
    variant: 'neutral',
    guidance: 'You withdrew your interest. You can express interest again if you change your mind.',
    icon: '↺',
  },
  unavailable: {
    label: 'Unavailable',
    variant: 'neutral',
    guidance: 'This campaign is not accepting new walkers at this time.',
    icon: '—',
  },
  closed: {
    label: 'Closed',
    variant: 'neutral',
    guidance: 'This campaign is closed and no longer accepting deliveries.',
    icon: '—',
  },
};

const InterestStateIndicator: React.FC<InterestStateIndicatorProps> = ({
  state,
  showGuidance = true,
}) => {
  const config = stateConfig[state];

  return (
    <div
      className="space-y-2"
      role="status"
      aria-live="polite"
      aria-label={`Campaign state: ${config.label}`}
    >
      <StatusChip label={config.label} variant={config.variant} size="sm" />
      {showGuidance && (
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <span className="inline-block mr-1">{config.icon}</span>
          {config.guidance}
        </p>
      )}
    </div>
  );
};

export default InterestStateIndicator;
