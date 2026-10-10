import React, { useCallback } from 'react';
import type { DoorData } from '../../models/door';
import ConfirmationDialog from '../mobile/ConfirmationDialog';

export type DoorExceptionType =
  | 'no-junk-mail'
  | 'inaccessible'
  | 'wrong-location'
  | 'manual-report'
  | 'skipped';

interface DoorExceptionPanelProps {
  door: DoorData & { id: string };
  exceptionType: DoorExceptionType;
  onSkip: (doorId: string, reason: string) => void;
  onReport: (doorId: string) => void;
  isLoading?: boolean;
}

const DoorExceptionPanel: React.FC<DoorExceptionPanelProps> = ({
  door,
  exceptionType,
  onSkip,
  onReport,
  isLoading = false,
}) => {
  const [showSkipConfirm, setShowSkipConfirm] = React.useState(false);

  const exceptionConfigs: Record<DoorExceptionType, {
    icon: string;
    title: string;
    message: string;
    primaryAction: string;
    secondaryAction?: string;
    color: 'blue' | 'amber' | 'red';
  }> = {
    'no-junk-mail': {
      icon: '🚫',
      title: 'No Junk Mail',
      message: 'This address has requested no unsolicited mail. Skip this delivery.',
      primaryAction: 'Skip Delivery',
      secondaryAction: 'Proceed Anyway',
      color: 'blue',
    },
    'inaccessible': {
      icon: '🔒',
      title: 'Inaccessible',
      message: 'Cannot access this address. Report and skip, or try again.',
      primaryAction: 'Report Issue',
      secondaryAction: 'Try Again',
      color: 'amber',
    },
    'wrong-location': {
      icon: '📍',
      title: 'Wrong Location',
      message: 'Address location seems incorrect. Report or skip?',
      primaryAction: 'Report Issue',
      secondaryAction: 'Skip',
      color: 'amber',
    },
    'manual-report': {
      icon: '⚠️',
      title: 'Report Issue',
      message: 'Describe what happened at this address.',
      primaryAction: 'Report',
      color: 'red',
    },
    'skipped': {
      icon: '↷',
      title: 'Skipped',
      message: 'You skipped this address. Continue to next door.',
      primaryAction: 'Continue',
      color: 'blue',
    },
  };

  const config = exceptionConfigs[exceptionType];

  const bgColor = {
    blue: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60',
    amber: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60',
    red: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/60',
  }[config.color];

  const textColor = {
    blue: 'text-blue-900 dark:text-blue-100',
    amber: 'text-amber-900 dark:text-amber-100',
    red: 'text-red-900 dark:text-red-100',
  }[config.color];

  const buttonColor = {
    blue: 'bg-blue-600 hover:bg-blue-700 text-white',
    amber: 'bg-amber-600 hover:bg-amber-700 text-white',
    red: 'bg-red-600 hover:bg-red-700 text-white',
  }[config.color];

  const handlePrimaryAction = useCallback(() => {
    if (exceptionType === 'no-junk-mail' || exceptionType === 'skipped') {
      onSkip(door.id, exceptionType);
    } else if (exceptionType === 'manual-report') {
      onReport(door.id);
    } else {
      onReport(door.id);
    }
  }, [exceptionType, door.id, onSkip, onReport]);

  const handleSecondaryAction = useCallback(() => {
    if (exceptionType === 'inaccessible' || exceptionType === 'wrong-location') {
      onSkip(door.id, exceptionType);
    }
  }, [exceptionType, door.id, onSkip]);

  return (
    <>
      <div className={`rounded-lg border ${bgColor} p-4`}>
        <div className="flex gap-3">
          <span className="text-2xl flex-shrink-0">{config.icon}</span>
          <div className="flex-1">
            <p className={`font-semibold ${textColor}`}>{config.title}</p>
            <p className={`mt-1 text-sm ${textColor}`}>{config.message}</p>
            <p className={`mt-2 text-xs ${textColor} opacity-75`}>
              {door.address}
            </p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={handlePrimaryAction}
            disabled={isLoading}
            className={`flex-1 rounded-lg ${buttonColor} px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50`}
            aria-label={config.primaryAction}
          >
            {isLoading ? '...' : config.primaryAction}
          </button>
          {config.secondaryAction && (
            <button
              onClick={handleSecondaryAction}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
              aria-label={config.secondaryAction}
            >
              {config.secondaryAction}
            </button>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showSkipConfirm}
        title="Skip this address?"
        message={`You're about to skip ${door.address}. This address will be marked as skipped.`}
        confirmLabel="Skip"
        confirmVariant="warning"
        onConfirm={() => {
          setShowSkipConfirm(false);
          onSkip(door.id, 'user-skip');
        }}
        onCancel={() => setShowSkipConfirm(false)}
      />
    </>
  );
};

export default DoorExceptionPanel;
