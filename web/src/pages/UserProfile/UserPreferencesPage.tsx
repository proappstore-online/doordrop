import React from "react";
import { useThemeMode } from "../../ThemeModeProvider";

const UserPreferencesPage: React.FC = () => {
  const { mode, setMode } = useThemeMode();

  const handleThemeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === "system") {
      const systemPrefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      setMode(systemPrefersDark ? "dark" : "light");
    } else {
      setMode(value as "light" | "dark");
    }
  };

  // Determine current selection for radio group
  const getThemeValue = () => {
    // Since we don't track "system" separately, just show current mode
    return mode;
  };

  return (
    <div className="max-w-2xl mx-auto py-2">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Preferences
      </h1>

      {/* Theme Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-3">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Appearance
          </h2>

          <fieldset>
            <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Theme
            </legend>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="light"
                  checked={getThemeValue() === "light"}
                  onChange={handleThemeChange}
                  className="w-4 h-4 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-gray-900 dark:text-gray-100">Light</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="dark"
                  checked={getThemeValue() === "dark"}
                  onChange={handleThemeChange}
                  className="w-4 h-4 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-gray-900 dark:text-gray-100">Dark</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="system"
                  checked={false}
                  onChange={handleThemeChange}
                  className="w-4 h-4 text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
                <span className="text-gray-900 dark:text-gray-100">System</span>
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Notifications
          </h2>

          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-900 dark:text-gray-100">Email notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive updates about your delivery schedule
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-900 dark:text-gray-100">Push notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get notified when your delivery is in progress
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700"></div>

            <div className="flex justify-between items-center">
              <div>
                <p className="text-gray-900 dark:text-gray-100">SMS reminders</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive text reminders before scheduled deliveries
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserPreferencesPage;
