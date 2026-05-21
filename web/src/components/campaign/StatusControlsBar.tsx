import React from "react";
import type { CampaignStatus } from "../../models/campaign";

interface StatusAction {
  label: string;
  status: CampaignStatus;
  className: string;
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
        <button
          key={action.status}
          onClick={() => onStatusChange(action.status)}
          disabled={statusUpdating}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${action.className}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
};

export default StatusControlsBar;
