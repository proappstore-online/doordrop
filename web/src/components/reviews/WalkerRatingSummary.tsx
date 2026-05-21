import React from "react";
import StarRating from "./StarRating";

interface WalkerRatingSummaryProps {
  average: number;
  count: number;
}

const WalkerRatingSummary: React.FC<WalkerRatingSummaryProps> = ({ average, count }) => {
  return (
    <div className="flex items-center gap-2">
      <StarRating value={average} readOnly size="small" />
      <p className="text-sm text-gray-700 dark:text-gray-300">
        {average.toFixed(1)} ({count} review{count === 1 ? "" : "s"})
      </p>
    </div>
  );
};

export default WalkerRatingSummary;
