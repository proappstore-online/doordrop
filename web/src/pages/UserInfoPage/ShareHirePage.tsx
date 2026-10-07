import React, { useEffect, useState } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import type { UserWithId } from "../../models/user";
import { UserRepository } from "../../repositories/userRepository";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { BookingRepository } from "../../repositories/bookingRepository";

const ShareHirePage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const { userData } = useUserData();
  const [walkers, setWalkers] = useState<UserWithId[]>([]);

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedWalker, setSelectedWalker] = useState<UserWithId | null>(null);
  const [date, setDate] = useState("");
  const [area, setArea] = useState<number>(0);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [savingBooking, setSavingBooking] = useState(false);

  useEffect(() => {
    if (!currentUser || !userData) return;

    const getWalkerUser = async () => {
      try {
        const walkerUsers = await UserRepository.getUsersByRole("walker");
        setWalkers(walkerUsers);
      } catch (error) {
        console.error(error);
      }
    };
    getWalkerUser();
  }, [currentUser, userData]);

  const handleSelectWalker = async (walker: UserWithId) => {
    setSelectedWalker(walker);
    setOpenDialog(true);
    setDate("");
    setArea(0);
    setShowConfirmation(false);
    if (!userData || !userData.campaignId) return;
    const groupDoc = await CampaignRepository.getGroup(userData.campaignId);
    if (groupDoc?.memberIds) setMemberCount(groupDoc.memberIds.length);
  };

  const handleConfirm = () => {
    setShowConfirmation(true);
  };

  const totalPrice =
    (area || 0) * (selectedWalker?.walkerProfile?.ratePerDoor || 0);
  const pricePerMember = memberCount > 0 ? totalPrice / memberCount : 0;

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-6">
        {walkers.map((walker, index) => (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md transition-transform hover:-translate-y-1 hover:shadow-lg"
          >
            {/* Profile Picture */}
            <img
              src={walker.photoURL || "/default-walker.jpg"}
              alt={walker.name}
              className="w-full h-45 object-contain rounded-t-xl"
            />

            <div className="p-6">
              {/* Name + Location */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                {walker.name}
              </h2>
              {walker.location && (
                <div className="flex items-center gap-2 mb-4">
                  <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {walker.location}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

              {/* Service Details */}
              <div className="space-y-1 text-sm mb-4">
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>Suburb:</strong> {walker.walkerProfile?.suburb}
                </p>
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>Postcode:</strong> {walker.walkerProfile?.postcode}
                </p>
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>Rate:</strong> ${walker.walkerProfile?.ratePerDoor}/door
                </p>
                <p className="text-gray-900 dark:text-gray-100">
                  <strong>Service Radius:</strong>{" "}
                  {walker.walkerProfile?.serviceRadiusKm} km
                </p>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

              {/* Contact Buttons */}
              <div className="flex gap-2">
                <a
                  href={`mailto:${walker.email}`}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-2 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Email
                </a>
                <button
                  onClick={() => handleSelectWalker(walker)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                  Select
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Dialog for scheduling */}
      {openDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            {!showConfirmation ? (
              <>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Schedule Delivery Service
                  </h2>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 [&::-webkit-calendar-picker-indicator]:dark:invert"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Number of doors
                    </label>
                    <input
                      type="number"
                      value={area}
                      onChange={(e) => setArea(Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                  <button
                    onClick={() => setOpenDialog(false)}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Confirmation
                  </h2>
                </div>
                <div className="p-6 space-y-2">
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Walker:</strong> {selectedWalker?.name}
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Date:</strong> {date}
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Doors:</strong> {area} doors
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">
                    <strong>Total Price:</strong> ${totalPrice.toFixed(2)}
                  </p>
                  <p className="text-gray-900 dark:text-gray-100">
                    Every member will share: ${pricePerMember.toFixed(2)}
                  </p>
                </div>
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
                  <button
                    onClick={() => setOpenDialog(false)}
                    className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                  <button
                    disabled={savingBooking}
                    onClick={async () => {
                      if (!currentUser || !userData?.campaignId || !selectedWalker) return;
                      setSavingBooking(true);
                      try {
                        await BookingRepository.create(userData.campaignId, {
                          walkerId: selectedWalker.id,
                          date: new Date(date),
                          doorCount: area,
                        });
                        setOpenDialog(false);
                      } catch (err) {
                        console.error("Failed to save booking:", err);
                      } finally {
                        setSavingBooking(false);
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {savingBooking ? "Saving..." : "Confirm Booking"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default ShareHirePage;
