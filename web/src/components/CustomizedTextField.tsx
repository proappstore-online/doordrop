import React from "react";

export interface CustomizedTextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  margin?: "none" | "dense" | "normal";
  multiline?: boolean;
  rows?: number;
  variant?: "outlined" | "filled" | "standard";
  InputProps?: {
    startAdornment?: React.ReactNode;
    endAdornment?: React.ReactNode;
  };
}

const CustomizedTextField = React.forwardRef<
  HTMLInputElement,
  CustomizedTextFieldProps
>(
  (
    {
      label,
      error,
      helperText,
      fullWidth,
      margin = "none",
      multiline,
      rows,
      className = "",
      InputProps,
      ...rest
    },
    ref
  ) => {
    const marginClasses = {
      none: "",
      dense: "my-1",
      normal: "my-2",
    };

    const baseClasses =
      "px-4 py-2.5 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors";
    const errorClasses = error
      ? "border-red-500 focus:ring-red-500"
      : "border-gray-300 dark:border-gray-600";
    const widthClass = fullWidth ? "w-full" : "";

    return (
      <div className={`${marginClasses[margin]} ${widthClass}`}>
        {label && (
          <label
            className={`block text-sm font-medium mb-1 ${
              error
                ? "text-red-600 dark:text-red-400"
                : "text-gray-700 dark:text-gray-300"
            }`}
          >
            {label}
          </label>
        )}
        <div className="relative">
          {InputProps?.startAdornment && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {InputProps.startAdornment}
            </div>
          )}
          {multiline ? (
            <textarea
              className={`${baseClasses} ${errorClasses} ${widthClass} ${className} ${
                InputProps?.startAdornment ? "pl-10" : ""
              } ${InputProps?.endAdornment ? "pr-10" : ""}`}
              rows={rows}
              {...(rest as any)}
            />
          ) : (
            <input
              ref={ref}
              className={`${baseClasses} ${errorClasses} ${widthClass} ${className} ${
                InputProps?.startAdornment ? "pl-10" : ""
              } ${InputProps?.endAdornment ? "pr-10" : ""}`}
              {...rest}
            />
          )}
          {InputProps?.endAdornment && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {InputProps.endAdornment}
            </div>
          )}
        </div>
        {helperText && (
          <p
            className={`text-sm mt-1 ${
              error
                ? "text-red-600 dark:text-red-400"
                : "text-gray-600 dark:text-gray-400"
            }`}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

CustomizedTextField.displayName = "CustomizedTextField";
export default CustomizedTextField;
