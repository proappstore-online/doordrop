import React from "react";

type LiveTrackingIndicatorProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
};

const LiveTrackingIndicator: React.FC<LiveTrackingIndicatorProps> = ({
  className = "",
  size = "sm",
  showLabel = false,
}) => {
  const sizeClasses = {
    sm: "w-2 h-2",
    md: "w-3 h-3",
    lg: "w-4 h-4",
  };

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className="relative">
        {/* Pulsing outer ring */}
        <span className={`absolute inset-0 ${sizeClasses[size]} rounded-full bg-emerald-400 animate-ping opacity-75`} />
        {/* Solid inner dot */}
        <span className={`relative inline-flex ${sizeClasses[size]} rounded-full bg-emerald-500`} />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
          Live
        </span>
      )}
    </div>
  );
};

export default LiveTrackingIndicator;
