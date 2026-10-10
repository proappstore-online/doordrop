import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { CampaignData } from '../../models/campaign';
import StatusChip from './StatusChip';
import ConfirmationDialog from './ConfirmationDialog';
import InterestStateIndicator from './InterestStateIndicator';

interface CampaignCardProps {
  campaign: CampaignData & { id: string };
  isInterested?: boolean;
  isAssigned?: boolean;
  onExpressInterest?: () => void;
  onWithdrawInterest?: () => void;
  isLoading?: boolean;
  className?: string;
}

const CampaignCard: React.FC<CampaignCardProps> = ({
  campaign,
  isInterested,
  isAssigned,
  onExpressInterest,
  onWithdrawInterest,
  isLoading,
  className = '',
}) => {
  const [showInterestConfirm, setShowInterestConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  const isAvailable = campaign.status === 'ready' || campaign.status === 'assigned';
  const isClosed = campaign.status === 'complete' || campaign.status === 'review' || campaign.status === 'payment' || campaign.status === 'archive';

  return (
    <article
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow ${className}`}
      role="region"
      aria-label={`Campaign: ${campaign.name}`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
              {campaign.name}
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {campaign.suburb} {campaign.postcode}
            </p>
          </div>
          <StatusChip
            label={campaign.status}
            variant={
              isAvailable
                ? 'info'
                : campaign.status === 'complete'
                  ? 'success'
                  : 'neutral'
            }
            size="sm"
          />
        </div>

        {/* Interest state with guidance */}
        {isClosed && (
          <div className="mb-3">
            <InterestStateIndicator state="closed" showGuidance={false} />
          </div>
        )}
        {!isClosed && isAssigned && (
          <div className="mb-3">
            <InterestStateIndicator state="assigned" showGuidance={false} />
          </div>
        )}
        {!isClosed && isInterested && !isAssigned && (
          <div className="mb-3">
            <InterestStateIndicator state="interest-submitted" showGuidance={false} />
          </div>
        )}
        {!isClosed && !isInterested && !isAssigned && isAvailable && (
          <div className="mb-3">
            <InterestStateIndicator state="available" showGuidance={false} />
          </div>
        )}

        {/* Key stats - fit decision data */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {campaign.totalDoors != null && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Doors</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {campaign.totalDoors}
              </p>
            </div>
          )}
          {campaign.budget != null && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Pay</p>
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                ${campaign.budget}
              </p>
            </div>
          )}
          {campaign.dueDate && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Due</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {new Date(campaign.dueDate).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })}
              </p>
            </div>
          )}
          {campaign.doorRadiusM && (
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-0.5">Radius</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {campaign.doorRadiusM}m
              </p>
            </div>
          )}
        </div>

        {/* Has flyer indicator */}
        {campaign.activePrintoutId && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1">
            <span>✓</span> Flyer included
          </p>
        )}

        {/* Actions - optimized for mobile */}
        <div className="flex gap-2">
          <Link
            to={`/walker/campaign/${campaign.id}`}
            className="flex-1 h-11 flex items-center justify-center px-3 py-2.5 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
            aria-label={`View details for ${campaign.name}`}
          >
            Details
          </Link>

          {!isAssigned && isAvailable && !isClosed && (
            <button
              onClick={() =>
                isInterested ? setShowWithdrawConfirm(true) : setShowInterestConfirm(true)
              }
              disabled={isLoading}
              className={`flex-1 h-11 px-3 py-2.5 text-sm font-medium rounded transition-colors flex items-center justify-center ${
                isInterested
                  ? 'border border-amber-600 dark:border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              aria-label={
                isInterested ? `Withdraw interest in ${campaign.name}` : `Express interest in ${campaign.name}`
              }
            >
              {isLoading ? '...' : isInterested ? 'Withdraw' : 'Interest'}
            </button>
          )}

          {isAssigned && (
            <button
              disabled
              className="flex-1 h-11 px-3 py-2.5 text-sm font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 rounded cursor-default"
              aria-label={`Already assigned to ${campaign.name}`}
            >
              Assigned
            </button>
          )}
        </div>

        {/* Confirmations */}
        <ConfirmationDialog
          isOpen={showInterestConfirm}
          title="Express Interest?"
          message={`Let the campaign admin know you're interested in "${campaign.name}". They'll review and assign if you're a good fit.`}
          confirmLabel="Express Interest"
          onConfirm={() => {
            setShowInterestConfirm(false);
            onExpressInterest?.();
          }}
          onCancel={() => setShowInterestConfirm(false)}
          isLoading={isLoading}
        />

        <ConfirmationDialog
          isOpen={showWithdrawConfirm}
          title="Withdraw Interest?"
          message={`You can express interest again later if you change your mind.`}
          confirmLabel="Withdraw"
          confirmVariant="warning"
          onConfirm={() => {
            setShowWithdrawConfirm(false);
            onWithdrawInterest?.();
          }}
          onCancel={() => setShowWithdrawConfirm(false)}
          isLoading={isLoading}
        />
      </div>
    </article>
  );
};

export default CampaignCard;
