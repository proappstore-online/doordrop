import React from "react";
import { Link } from "react-router-dom";
import type { UserData } from "../../models/user";
import type { WalkerInterest } from "../../models/walkerInterest";

interface WalkerInterestPanelProps {
  interestedWalkers: {
    interest: WalkerInterest & { id: string };
    walker: UserData & { id: string };
    voteCount: number;
    userVoted: boolean;
  }[];
  assignedWalkerId: string | null;
  votingId: string | null;
  assigningWalkerId: string | null;
  isCampaignClosed: boolean;
  onVote: (interestId: string) => void;
  onAssign: (walkerId: string) => void;
}

const WalkerInterestPanel: React.FC<WalkerInterestPanelProps> = ({
  interestedWalkers,
  assignedWalkerId,
  votingId,
  assigningWalkerId,
  isCampaignClosed,
  onVote,
  onAssign,
}) => {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Interested Walkers ({interestedWalkers.length})
      </h2>
      {interestedWalkers.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No walkers have expressed interest yet. Once your campaign is visible, walkers in the area can express interest and you'll be able to review and assign one here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {interestedWalkers.map((item) => {
            const isCurrentlyAssigned = assignedWalkerId === item.walker.id;
            return (
              <div
                key={item.interest.id}
                className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 space-y-3 ${isCurrentlyAssigned ? "ring-2 ring-emerald-500" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      {item.walker.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.walker.walkerProfile?.suburb || item.walker.suburb}
                    </p>
                  </div>
                  {isCurrentlyAssigned && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
                      Assigned
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                  {item.walker.walkerProfile?.ratePerDoor != null && (
                    <p><strong>Rate:</strong> ${item.walker.walkerProfile.ratePerDoor}/door</p>
                  )}
                  {item.walker.walkerProfile?.serviceRadiusKm != null && (
                    <p><strong>Radius:</strong> {item.walker.walkerProfile.serviceRadiusKm} km</p>
                  )}
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Votes: <strong>{item.voteCount}</strong>
                  </span>
                  <div className="flex gap-2">
                    <Link
                      to={`/walker/${item.walker.id}`}
                      className="px-3 py-1.5 text-sm border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg no-underline"
                    >
                      Profile
                    </Link>
                    <button
                      disabled={item.userVoted || votingId === item.interest.id}
                      onClick={() => onVote(item.interest.id)}
                      className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg"
                    >
                      {item.userVoted ? "Voted" : "Vote"}
                    </button>
                    {!isCurrentlyAssigned && !isCampaignClosed && (
                      <button
                        onClick={() => onAssign(item.walker.id)}
                        disabled={!!assigningWalkerId}
                        className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg"
                      >
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default WalkerInterestPanel;
