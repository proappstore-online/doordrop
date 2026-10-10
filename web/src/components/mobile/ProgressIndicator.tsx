import React from 'react';

interface ProgressStep {
  label: string;
  completed?: boolean;
  current?: boolean;
}

interface ProgressIndicatorProps {
  steps: ProgressStep[];
  variant?: 'linear' | 'circular';
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  steps,
  variant = 'linear',
}) => {
  const completedCount = steps.filter((s) => s.completed).length;

  if (variant === 'circular') {
    return (
      <div className="flex items-center gap-2" role="progressbar" aria-valuenow={completedCount} aria-valuemax={steps.length}>
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step.completed
                ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                : step.current
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
            aria-label={`${step.label}: ${step.completed ? 'Complete' : step.current ? 'Current' : 'Pending'}`}
          >
            {step.completed ? (
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                role="img"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            ) : (
              idx + 1
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div role="progressbar" aria-valuenow={completedCount} aria-valuemax={steps.length}>
      <div className="flex gap-1 items-center h-8">
        {steps.map((step, idx) => (
          <React.Fragment key={idx}>
            <div
              className={`flex-1 h-1 rounded-full transition-colors ${
                step.completed
                  ? 'bg-emerald-600 dark:bg-emerald-500'
                  : step.current
                    ? 'bg-blue-600 dark:bg-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
              }`}
              aria-label={`${step.label}: ${step.completed ? 'Complete' : step.current ? 'Current' : 'Pending'}`}
            />
            {idx < steps.length - 1 && <div className="w-0.5" />}
          </React.Fragment>
        ))}
      </div>
      <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-2">
        {steps.map((step, idx) => (
          <span key={idx} className="text-center flex-1 truncate">
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
};

export default ProgressIndicator;
