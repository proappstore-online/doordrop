import React, { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { UserRepository } from "../../repositories/userRepository";
import type { UserData } from "../../models/user";

interface UserProfileDetailsCardProps {
  userId: string;
}

const normalizeUrl = (url: string): string => {
  if (!url?.startsWith("http://") && !url?.startsWith("https://")) {
    return `https://${url}`;
  }
  return url || "";
};

const UserProfileDetailsCard: React.FC<UserProfileDetailsCardProps> = ({
  userId,
}) => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userData, setUserData] = useState<(UserData & { id: string }) | null>(
    null
  );

  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) {
        setError("User ID is missing.");
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const data = await UserRepository.getUser(userId);
        if (data) {
          setUserData(data);
        } else {
          setError("User profile not found.");
        }
      } catch (err) {
        console.error("Error fetching user data:", err);
        setError("Failed to fetch user profile data.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  const handleShare = () => {
    const profileUrl = `${window.location.origin}/app/user/${userId}`;
    navigator.clipboard.writeText(profileUrl).then(() => {
      alert("User profile URL copied to clipboard!");
    });
  };

  const handleEditProfile = () => {
    const basePath = location.pathname.startsWith("/walker") ? "/walker" : "/app";
    navigate(`${basePath}/user/${userId}/edit`);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4 p-6">
        <div className="flex justify-center">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (error && !userData) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4 p-6">
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
        {currentUser?.id === userId && (
          <div className="mt-4">
            <button
              onClick={handleEditProfile}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors mr-2"
            >
              Edit Profile
            </button>
          </div>
        )}
      </div>
    );
  }

  const profileName =
    userData?.name ||
    `${userData?.firstName || ""} ${userData?.lastName || ""}`.trim() ||
    "User Profile";
  const displayEmail = userData?.email;
  const displayCountry = userData?.country;
  const displayLocation = userData?.location;
  const displayWebsite = userData?.website;
  const displayLinkedin = userData?.linkedin;
  const displayPhotoURL = userData?.photoURL;
  const displayBio = userData?.bio;
  const displayRole = userData?.role;
  const displayGroup = userData?.campaignId;
  const walkerProfile = userData?.walkerProfile;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md mb-4 p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
          {displayPhotoURL ? (
            <img src={displayPhotoURL} alt={profileName} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span>{profileName?.charAt(0).toUpperCase()}</span>
          )}
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {profileName}
        </h2>
      </div>

      {displayEmail && (
        <p className="text-gray-900 dark:text-gray-100 mb-2">
          Email: {displayEmail}
        </p>
      )}
      {displayLocation && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Location: {displayLocation}
        </p>
      )}
      {displayCountry && (
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          Country: {displayCountry}
        </p>
      )}
      {displayBio && (
        <p className="text-gray-900 dark:text-gray-100 mt-4 mb-4">
          {displayBio}
        </p>
      )}

      {displayRole && (
        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
          Role: {displayRole}
        </p>
      )}
      {displayGroup && (
        <p className="text-sm text-gray-900 dark:text-gray-100 mb-2">
          Campaign ID: {displayGroup}
        </p>
      )}

      {displayRole === "walker" && walkerProfile && (
        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Walker Profile
          </h3>
          {walkerProfile.suburb && (
            <p className="text-sm text-gray-900 dark:text-gray-100">
              Suburb: {walkerProfile.suburb}
            </p>
          )}
          {walkerProfile.postcode && (
            <p className="text-sm text-gray-900 dark:text-gray-100">
              Postcode: {walkerProfile.postcode}
            </p>
          )}
          <p className="text-sm text-gray-900 dark:text-gray-100">
            Radius: {walkerProfile.serviceRadiusKm} km
          </p>
          {walkerProfile.ratePerDoor && (
            <p className="text-sm text-gray-900 dark:text-gray-100">
              Rate: ${walkerProfile.ratePerDoor}/door
            </p>
          )}
          {walkerProfile.bio && (
            <p className="text-sm text-gray-900 dark:text-gray-100 mt-2">
              {walkerProfile.bio}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 mt-6">
        {displayWebsite && (
          <a
            href={normalizeUrl(displayWebsite)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            🌐 Website
          </a>
        )}
        {displayLinkedin && (
          <a
            href={normalizeUrl(displayLinkedin)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            🔗 LinkedIn
          </a>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {currentUser?.id === userId && (
          <button
            onClick={handleEditProfile}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Edit Profile
          </button>
        )}
        <button
          onClick={handleShare}
          className="border border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 py-2 px-4 rounded-lg transition-colors"
        >
          Share
        </button>
      </div>
    </div>
  );
};

export default UserProfileDetailsCard;
