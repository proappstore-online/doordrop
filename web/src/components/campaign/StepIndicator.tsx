import React from "react";

export interface Step {
  id: string;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  return (
    <div className="mb-8">
      <div
        role="progressbar"
        aria-valuenow={currentStep}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label={`Step ${currentStep} of ${steps.length}: ${steps[currentStep - 1]?.label || ""}`}
        className="mb-4"
      >
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Step {currentStep} of {steps.length} – {steps[currentStep - 1]?.label}
        </p>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div
            className="bg-emerald-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / steps.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Visual step indicators */}
      <div className="flex justify-between gap-2">
        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;

          return (
            <div
              key={step.id}
              className="flex-1"
              aria-current={isCurrent ? "step" : undefined}
            >
              <button
                type="button"
                disabled={stepNumber > currentStep}
                className={`w-full aspect-square rounded-lg font-medium text-sm transition-all ${
                  isCompleted
                    ? "bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : isCurrent
                      ? "bg-emerald-600 text-white shadow-md"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                }`}
                title={step.label}
                aria-label={`Step ${stepNumber}: ${step.label}${isCompleted ? " (completed)" : isCurrent ? " (current)" : ""}`}
              >
                {isCompleted ? (
                  <svg className="w-5 h-5 mx-auto" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  stepNumber
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
