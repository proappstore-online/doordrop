import React from "react";

interface MutationErrorBannerProps {
  message: string;
  onDismiss: () => void;
}

const MutationErrorBanner: React.FC<MutationErrorBannerProps> = ({ message, onDismiss }) => (
  <div
    role="alert"
    className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200"
  >
    <div className="flex gap-3">
      <svg
        className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
          clipRule="evenodd"
        />
      </svg>
      <div className="flex-1">
        <p>{message}</p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
      >
        ✕
      </button>
    </div>
  </div>
);

export default MutationErrorBanner;
