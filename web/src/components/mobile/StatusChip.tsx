import React from 'react';

export type StatusChipVariant =
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'assigned'
  | 'active'
  | 'complete';

const variantStyles: Record<StatusChipVariant, string> = {
  success: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  error: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  neutral: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  pending: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  assigned: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  active: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  complete: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

interface StatusChipProps {
  label: string;
  variant: StatusChipVariant;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
}

const StatusChip: React.FC<StatusChipProps> = ({
  label,
  variant,
  icon,
  size = 'md',
}) => {
  const sizeClasses = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm';

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses} ${variantStyles[variant]}`}
      role="status"
      aria-label={`Status: ${label}`}
    >
      {icon && <span className="flex-shrink-0">{icon}</span>}
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
};

export default StatusChip;
