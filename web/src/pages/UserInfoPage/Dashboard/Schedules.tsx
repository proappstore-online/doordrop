import React from "react";
import type { DeliveryRunData } from "../../../models/deliveryRun";

interface User {
  id: string;
  name: string;
  photoURL?: string;
  createdAt?: any;
}

interface SchedulesProps {
  users: User[];
  schedules: (DeliveryRunData & { id: string })[];
  getUserById: (id?: string | null) => User | undefined;
  formatDate: (date: any) => string;
}

const Schedules: React.FC<SchedulesProps> = ({
  users: _users,
  schedules,
  getUserById,
  formatDate,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* Delivery Schedule */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Delivery Schedule
          </h2>
          {schedules.length === 0 ? (
            <p className="text-gray-500 dark:text-gray-400">N/A</p>
          ) : (
            <div className="flex flex-col gap-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center gap-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
                >
                  <span className="font-medium min-w-[100px] capitalize text-gray-900 dark:text-gray-100">
                    {schedule.status || "scheduled"}
                  </span>
                  <span className="min-w-[120px] text-gray-900 dark:text-gray-100">
                    {formatDate(schedule.date)}
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {getUserById(schedule.walkerId)?.name || "N/A"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Schedules;
