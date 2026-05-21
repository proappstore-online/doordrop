import React from "react";
import { useNavigate } from "react-router-dom";

const HelpPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <button
        onClick={() => navigate(-1)}
        className="mb-4 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Help & Support
      </h1>

      {/* Getting Started */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Getting Started
        </h2>
        <div className="space-y-3 text-gray-700 dark:text-gray-300">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">For Clients</h3>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
              <li>Complete your profile in Account Settings</li>
              <li>Create a new campaign by clicking "+ New Campaign"</li>
              <li>Add your flyer and select delivery areas</li>
              <li>Choose a walker or let walkers express interest</li>
              <li>Track delivery progress in real-time</li>
            </ol>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">For Walkers</h3>
            <ol className="list-decimal list-inside space-y-1 ml-2 text-sm">
              <li>Complete your walker profile</li>
              <li>Browse available campaigns</li>
              <li>Express interest or accept assignments</li>
              <li>Start tracking when you begin deliveries</li>
              <li>Doors auto-mark as delivered within 100m</li>
            </ol>
          </div>
        </div>
      </section>

      {/* Tracking FAQ */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Tracking & Delivery
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              How does auto-delivery work?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              When you start tracking, doors are automatically marked as delivered when you walk within the geofence radius (default 100m). The map follows your position in real-time.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Can I use the app in the background?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Yes! Install the app to your home screen (PWA). Tracking continues when you switch apps, though iOS limits background GPS to ~3 minutes. Keep the app visible for best results.
            </p>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              What if I stop tracking and restart?
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              All previous tracking data is preserved. The map shows cumulative data from all sessions in the last 24 hours. No data is lost.
            </p>
          </div>
        </div>
      </section>

      {/* Technical Support */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Troubleshooting
        </h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Doors not auto-marking as delivered?
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Check that location permissions are enabled</li>
              <li>Make sure tracking is active (green indicator)</li>
              <li>Verify you're within the geofence radius (check campaign settings)</li>
              <li>Use the "Show Debug Info" button to see detailed diagnostics</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Map not following my position?
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Refresh the page and restart tracking</li>
              <li>Check location permissions in browser/device settings</li>
              <li>Try switching between WiFi and mobile data</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              GPS accuracy issues?
            </h3>
            <ul className="list-disc list-inside space-y-1 ml-2 text-sm text-gray-700 dark:text-gray-300">
              <li>Move to an open area away from tall buildings</li>
              <li>Wait a few seconds for GPS to acquire satellites</li>
              <li>Enable high-accuracy mode in device settings</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Need More Help?
        </h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          Can't find what you're looking for? Get in touch with our support team.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <a href="mailto:support@doordrop.com.au" className="text-emerald-600 hover:underline dark:text-emerald-400">
              support@doordrop.com.au
            </a>
          </div>
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Use the "Show Debug Info" button on tracking pages to share technical details with support</span>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HelpPage;
