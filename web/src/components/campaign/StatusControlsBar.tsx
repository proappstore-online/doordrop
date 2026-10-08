import React from "react";
import type { CampaignStatus } from "../../models/campaign";

interface StatusAction {
  label: string;
  status: CampaignStatus;
  className: string;
  disabled?: boolean;
  tooltip?: string;
}

interface StatusControlsBarProps {
  statusActions: StatusAction[];
  statusUpdating: boolean;
  onStatusChange: (status: CampaignStatus) => void;
}

const StatusControlsBar: React.FC<StatusControlsBarProps> = ({
  statusActions,
  statusUpdating,
  onStatusChange,
}) => {
  if (statusActions.length === 0) return null;

  return (
    <div className="flex gap-2">
      {statusActions.map((action) => (
        <div key={action.status} title={action.tooltip}>
          <button
            onClick={() => onStatusChange(action.status)}
            disabled={statusUpdating || action.disabled}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${action.className}`}
          >
            {action.label}
          </button>
        </div>
      ))}
    </div>
  );
};

export default StatusControlsBar;
