import React, { useEffect, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import ContactDetailsCard from "./UserProfileDetailsCard";

const UserProfilePage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const location = useLocation();
  const { currentUser } = useAuthContext();
  const isWalkerRoute = location.pathname.startsWith("/walker");
  const [isCurrentUser, setIsCurrentUser] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!userId) {
        setError("User ID is missing.");
        setLoading(false);
        return;
      }
      try {
        // Check if the profile belongs to the current user
        setIsCurrentUser(currentUser?.id === userId);
      } catch (err) {
        console.error("Error fetching user profile details:", err);
        setError("Failed to fetch user profile details.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserProfile();
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className="flex justify-center mt-8">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <h2 className="text-xl font-semibold text-red-600 dark:text-red-400">
          {error}
        </h2>
      </div>
    );
  }

  if (!userId) {
    return (
      <div className="max-w-6xl mx-auto px-4 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          User profile details not available.
        </h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24">
      <div className="max-w-6xl mx-auto px-4 mt-8 pb-8 overflow-y-auto">
        <ContactDetailsCard userId={userId} />

        {isWalkerRoute && isCurrentUser && (
          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Tracking Tips
            </h3>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1.5 list-disc list-inside">
              <li>Keep the app open and in the foreground while delivering for the best tracking accuracy.</li>
              <li>The screen will stay on automatically during an active tracking session.</li>
              <li>If you switch to another app briefly (check a text, take a photo), tracking will resume when you come back.</li>
              <li>Avoid leaving the app in the background for more than 30 seconds — GPS tracking pauses on iOS when the app is not visible, and nearby doors won't auto-deliver.</li>
              <li>If tracking gets interrupted, it will automatically resume your session when you reopen the app.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfilePage;
