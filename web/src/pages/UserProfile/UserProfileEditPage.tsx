import React, { useEffect, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { UserRepository } from "../../repositories/userRepository";
import type { UserData } from "../../models/user";
import { useAuthContext } from "../../hooks/useAuthContext";
import { uploadFile } from "../../utils/storageUpload";

const UserProfileEditPage: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();

  const [userData, setUserData] = useState<Partial<UserData>>({});
  const [walkerProfile, setWalkerProfile] = useState<
    Partial<UserData["walkerProfile"]>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Fetch existing user data
  useEffect(() => {
    const fetchUserData = async () => {
      if (!userId) {
        setError("User ID is missing.");
        setLoading(false);
        return;
      }
      if (currentUser?.id !== userId) {
        setError("You are not authorized to edit this profile.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const data = await UserRepository.getUser(userId);
        if (data) {
          // The DB stores a single `name`; split it for the two form fields.
          const [firstName = "", ...rest] = (data.name || "").split(" ");
          setUserData({ ...data, firstName: data.firstName ?? firstName, lastName: data.lastName ?? rest.join(" ") });
          if (data.role === "walker" && data.walkerProfile) {
            setWalkerProfile(data.walkerProfile);
          }
        } else {
          setUserData({});
        }
      } catch (err) {
        console.error("Error fetching user profile data:", err);
        setError("Failed to load user profile data.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId, currentUser]);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setUserData((prevData) => ({ ...prevData, [name]: value }));
    },
    []
  );

  const handleWalkerChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = event.target;
      setWalkerProfile((prev) => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSave = async () => {
    if (!userId) {
      setError("User ID is missing.");
      return;
    }
    if (currentUser?.id !== userId) {
      setError("You are not authorized to save this profile.");
      return;
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(false);
    try {
      const { id: _id, ...dataToSave } = userData as Partial<UserData> & {
        id?: string;
      };

      dataToSave.name = [dataToSave.firstName, dataToSave.lastName].filter(Boolean).join(" ") || dataToSave.name;
      // The users table has no first/last name or timestamp columns the client may set.
      delete dataToSave.firstName;
      delete dataToSave.lastName;
      delete dataToSave.createdAt;
      delete dataToSave.updatedAt;
      delete dataToSave.role;
      delete dataToSave.email;

      if (photoFile) {
        const ext = photoFile.name.split(".").pop() || "jpg";
        const photoURL = await uploadFile(`users/${userId}/profile.${ext}`, photoFile);
        dataToSave.photoURL = photoURL;
      }

      if (userData.role === "walker") {
        (dataToSave as any).walkerProfile = {
          ...walkerProfile,
          serviceRadiusKm: Number(walkerProfile?.serviceRadiusKm ?? 0),
          ratePerDoor: walkerProfile?.ratePerDoor
            ? Number(walkerProfile?.ratePerDoor)
            : undefined,
          profilePhotoUrl: dataToSave.photoURL ?? walkerProfile?.profilePhotoUrl,
        };
      }
      await UserRepository.updateUser(userId, dataToSave as Partial<UserData>);
      setSaveSuccess(true);
      setTimeout(() => navigate(`/app/user/${userId}`), 1500);
    } catch (err) {
      console.error("Error saving user profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigate(userData.createdAt ? `/app/user/${userId}` : "/app");
  };

  if (loading) {
    return (
      <div className="flex justify-center mt-8">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !Object.keys(userData).length) {
    return (
      <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
      </div>
    );
  }
  if (currentUser?.id !== userId && !loading) {
    return (
      <div className="m-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-sm text-red-800 dark:text-red-200">
          You are not authorized to edit this profile.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 text-center">
        Edit Profile
      </h1>

      {error && !saveSuccess && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      {saveSuccess && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            Profile saved successfully!
          </p>
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Name
          </label>
          <input
            type="text"
            name="firstName"
            value={userData.firstName || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last Name
          </label>
          <input
            type="text"
            name="lastName"
            value={userData.lastName || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            name="email"
            value={userData.email || ""}
            readOnly
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Email cannot be changed here.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Location (City, State)
          </label>
          <input
            type="text"
            name="location"
            value={userData.location || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Country
          </label>
          <input
            type="text"
            name="country"
            value={userData.country || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Website URL
          </label>
          <input
            type="url"
            name="website"
            value={userData.website || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            LinkedIn Profile URL
          </label>
          <input
            type="url"
            name="linkedin"
            value={userData.linkedin || ""}
            onChange={handleChange}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio / About Me
          </label>
          <textarea
            name="bio"
            value={userData.bio || ""}
            onChange={handleChange}
            disabled={saving}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
          />
        </div>

        {userData.role === "walker" && (
          <div className="mt-8 space-y-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Walker Profile
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Suburb
              </label>
              <input
                type="text"
                name="suburb"
                value={walkerProfile?.suburb || ""}
                onChange={handleWalkerChange}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Postcode
              </label>
              <input
                type="text"
                name="postcode"
                value={walkerProfile?.postcode || ""}
                onChange={handleWalkerChange}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Service Radius (km)
              </label>
              <input
                type="number"
                name="serviceRadiusKm"
                value={walkerProfile?.serviceRadiusKm || ""}
                onChange={handleWalkerChange}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Rate per door ($)
              </label>
              <input
                type="number"
                name="ratePerDoor"
                value={walkerProfile?.ratePerDoor || ""}
                onChange={handleWalkerChange}
                disabled={saving}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Walker Bio
              </label>
              <textarea
                name="bio"
                value={walkerProfile?.bio || ""}
                onChange={handleWalkerChange}
                disabled={saving}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50"
              />
            </div>
          </div>
        )}

        <div className="my-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            Profile Picture
          </h3>
          {(photoPreview || userData.photoURL) && (
            <img
              src={photoPreview || userData.photoURL}
              alt="Profile"
              className="w-24 h-24 rounded-full object-cover mb-2"
            />
          )}
          <input
            type="file"
            accept="image/*"
            disabled={saving}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (photoPreview) URL.revokeObjectURL(photoPreview);
              setPhotoFile(file);
              setPhotoPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="text-sm text-gray-600 dark:text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 dark:file:bg-emerald-900/30 dark:file:text-emerald-300 hover:file:bg-emerald-100"
          />
        </div>

        <div className="flex justify-between mt-8">
          <button
            onClick={handleCancel}
            disabled={saving}
            className="border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserProfileEditPage;
