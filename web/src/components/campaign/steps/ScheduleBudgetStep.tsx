import React, { useState } from "react";
import type { CampaignData } from "../../../models/campaign";

interface ScheduleBudgetStepProps {
  data: Partial<CampaignData>;
  onChange: (data: Partial<CampaignData>) => void;
  isLoading?: boolean;
}

const ScheduleBudgetStep: React.FC<ScheduleBudgetStepProps> = ({ data, onChange, isLoading = false }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const formatDateForInput = (date?: Date): string => {
    if (!date) return "";
    return date instanceof Date ? date.toISOString().split("T")[0] : "";
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nextErrors = { ...errors };
    delete nextErrors.startDate;

    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date < today) {
        nextErrors.startDate = "Start date cannot be in the past";
      } else if (data.dueDate) {
        const dueDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
        if (date > dueDate) {
          nextErrors.startDate = "Start date must be before end date";
        }
      }
    }

    setErrors(nextErrors);
    onChange({ ...data, dueDate: value ? new Date(value) : undefined });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nextErrors = { ...errors };
    delete nextErrors.endDate;

    if (value) {
      const date = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (date < today) {
        nextErrors.endDate = "End date cannot be in the past";
      } else if (data.dueDate) {
        const startDate = data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate);
        if (date < startDate) {
          nextErrors.endDate = "End date must be after start date";
        }
      }
    }

    setErrors(nextErrors);
    onChange({ ...data, dueDate: value ? new Date(value) : undefined });
  };

  const handleBudgetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const nextErrors = { ...errors };
    delete nextErrors.budget;

    if (value) {
      const budget = parseFloat(value);
      if (isNaN(budget) || budget < 0) {
        nextErrors.budget = "Budget must be a positive number";
      } else if (budget > 1000000) {
        nextErrors.budget = "Budget seems unusually high";
      }
    }

    setErrors(nextErrors);
    onChange({ ...data, budget: value ? parseFloat(value) : undefined });
  };

  const isValid = data.dueDate !== undefined && data.budget !== undefined && Object.keys(errors).length === 0;

  return (
    <fieldset className="space-y-4">
      <legend className="sr-only">Campaign schedule and budget</legend>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/60 rounded-lg p-4 mb-4">
        <p className="text-sm text-blue-900 dark:text-blue-200">
          <strong>Note:</strong> These dates are target dates for campaign completion. Actual delivery may vary based on walker availability and conditions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="start-date" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            id="start-date"
            type="date"
            value={formatDateForInput(data.dueDate)}
            onChange={handleStartDateChange}
            disabled={isLoading}
            aria-invalid={Boolean(errors.startDate)}
            aria-describedby={errors.startDate ? "start-date-error" : undefined}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
              errors.startDate ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
          />
          {errors.startDate && (
            <p id="start-date-error" className="text-sm text-red-500 mt-1">
              {errors.startDate}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="end-date" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            End Date <span className="text-red-500">*</span>
          </label>
          <input
            id="end-date"
            type="date"
            value={formatDateForInput(data.dueDate)}
            onChange={handleEndDateChange}
            disabled={isLoading}
            aria-invalid={Boolean(errors.endDate)}
            aria-describedby={errors.endDate ? "end-date-error" : undefined}
            className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
              errors.endDate ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
          />
          {errors.endDate && (
            <p id="end-date-error" className="text-sm text-red-500 mt-1">
              {errors.endDate}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="budget" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
          Budget (AUD) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2">
          <span className="text-gray-600 dark:text-gray-400 font-medium">$</span>
          <input
            id="budget"
            type="number"
            value={data.budget || ""}
            onChange={handleBudgetChange}
            placeholder="e.g., 500"
            min="0"
            step="10"
            disabled={isLoading}
            aria-invalid={Boolean(errors.budget)}
            aria-describedby={errors.budget ? "budget-error" : "budget-hint"}
            className={`flex-1 px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 ${
              errors.budget ? "border-red-500" : "border-gray-300 dark:border-gray-600"
            }`}
          />
        </div>
        {errors.budget && (
          <p id="budget-error" className="text-sm text-red-500 mt-1">
            {errors.budget}
          </p>
        )}
        {!errors.budget && (
          <p id="budget-hint" className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Typical budgets are $200–$2000 depending on area and delivery method
          </p>
        )}
      </div>

      {isValid && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
          ✓ Schedule and budget confirmed
        </div>
      )}
    </fieldset>
  );
};

export default ScheduleBudgetStep;
