import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { UserRepository } from "../../repositories/userRepository";
import { WalkerReviewRepository } from "../../repositories/walkerReviewRepository";
import WalkerRatingSummary from "../../components/reviews/WalkerRatingSummary";
import ReviewList from "../../components/reviews/ReviewList";
import type { UserData } from "../../models/user";

const WalkerPublicProfile: React.FC = () => {
  const { walkerId } = useParams();
  const [walker, setWalker] = useState<(UserData & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ average: number; count: number }>({ average: 0, count: 0 });

  useEffect(() => {
    const load = async () => {
      if (!walkerId) return;
      setLoading(true);
      try {
        const walkerDoc = await UserRepository.getUser(walkerId);
        setWalker(walkerDoc);
        const summary = await WalkerReviewRepository.getReviewStats(walkerId);
        setStats(summary);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [walkerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!walkerId || !walker) {
    return (
      <div className="max-w-5xl mx-auto p-3">
        <p className="text-gray-600 dark:text-gray-400">Walker not found.</p>
      </div>
    );
  }

  const wp = walker.walkerProfile;
  const displayName = wp?.firstName && wp?.lastName
    ? `${wp.firstName} ${wp.lastName}`
    : walker.name;
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const totalHours = wp?.totalMinutesSpent ? Math.round(wp.totalMinutesSpent / 60) : 0;

  const vehicleLabels: Record<string, string> = {
    on_foot: "On Foot",
    bicycle: "Bicycle",
    scooter: "Scooter",
    car: "Car",
  };

  const timeSlotLabels: Record<string, string> = {
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    flexible: "Flexible",
  };

  return (
    <div className="max-w-5xl mx-auto p-2 md:p-3 space-y-4">
      {/* Hero */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
        <div className="flex items-center gap-4">
          {wp?.profilePhotoUrl ? (
            <img
              src={wp.profilePhotoUrl}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-700 dark:text-emerald-300 text-xl font-bold">
              {initials}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{displayName}</h1>
            <p className="text-gray-600 dark:text-gray-400">{wp?.suburb || walker.suburb}</p>
            <WalkerRatingSummary average={stats.average} count={stats.count} />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wp?.totalCampaignsCompleted || 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Campaigns</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wp?.totalDoorsDelivered || 0}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Doors Delivered</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wp?.totalKmWalked ? wp.totalKmWalked.toFixed(1) : "0"}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Km Walked</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalHours}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Hours Spent</p>
        </div>
      </div>

      {/* About */}
      {(wp?.bio || wp?.serviceRadiusKm || wp?.vehicleType || wp?.availableDays?.length) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">About</h2>
          {wp?.bio && (
            <p className="text-gray-700 dark:text-gray-300 mb-4">{wp.bio}</p>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {wp?.serviceRadiusKm && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Service Radius</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{wp.serviceRadiusKm} km</p>
              </div>
            )}
            {wp?.ratePerDoor != null && wp.ratePerDoor > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Rate</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">${wp.ratePerDoor}/door</p>
              </div>
            )}
            {wp?.vehicleType && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Transport</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{vehicleLabels[wp.vehicleType] || wp.vehicleType}</p>
              </div>
            )}
            {wp?.preferredTimeSlot && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Preferred Time</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{timeSlotLabels[wp.preferredTimeSlot] || wp.preferredTimeSlot}</p>
              </div>
            )}
            {wp?.maxDoorsPerDay && wp.maxDoorsPerDay > 0 && (
              <div>
                <span className="text-gray-500 dark:text-gray-400">Max Doors/Day</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{wp.maxDoorsPerDay}</p>
              </div>
            )}
          </div>
          {wp?.availableDays && wp.availableDays.length > 0 && (
            <div className="mt-3">
              <span className="text-sm text-gray-500 dark:text-gray-400">Available</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {wp.availableDays.map((day) => (
                  <span
                    key={day}
                    className="px-2 py-0.5 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                  >
                    {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Verification Badges */}
      {(wp?.hasPoliceCheck || wp?.hasWWCC || wp?.hasABN) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-3">Verification</h2>
          <div className="flex flex-wrap gap-3">
            {wp?.hasPoliceCheck && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Police Check
              </span>
            )}
            {wp?.hasWWCC && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                WWCC
              </span>
            )}
            {wp?.hasABN && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ABN Registered
              </span>
            )}
          </div>
        </div>
      )}

      {/* Reviews */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Reviews
          </h2>
          <ReviewList walkerId={walkerId} />
        </div>
      </div>
    </div>
  );
};

export default WalkerPublicProfile;
