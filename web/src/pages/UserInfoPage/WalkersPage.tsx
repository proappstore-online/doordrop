import React, { useEffect, useMemo, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useUserData } from "../../hooks/useUserData";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import { UserRepository } from "../../repositories/userRepository";
import type { WalkerInterest } from "../../models/walkerInterest";
import type { UserData } from "../../models/user";

type InterestCard = {
  interest: WalkerInterest & { id: string };
  walker: UserData & { id: string };
  voteCount: number;
  userVoted: boolean;
};

const WalkersPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const { userData } = useUserData();
  const [items, setItems] = useState<InterestCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [votingInterestId, setVotingInterestId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const campaignId = userData?.campaignId;
    if (!campaignId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const interests =
          await WalkerInterestRepository.getInterestsByCampaign(
            campaignId
          );

        const enriched = await Promise.all(
          interests.map(async (interest) => {
            const walker = await UserRepository.getUser(interest.walkerId);
            if (!walker) return null;
            const [voteCount, userVoted] = await Promise.all([
              WalkerInterestRepository.getVoteCount(interest.id),
              WalkerInterestRepository.hasUserVoted(
                interest.id,
                currentUser.id
              ),
            ]);
            return {
              interest,
              walker: { ...walker, id: walker.id },
              voteCount,
              userVoted,
            } as InterestCard;
          })
        );

        setItems(enriched.filter(Boolean) as InterestCard[]);
      } catch (error) {
        console.error("Failed to load walker interests:", error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentUser, userData?.campaignId]);

  const handleVote = async (interestId: string) => {
    if (!currentUser) return;
    setVotingInterestId(interestId);
    try {
      await WalkerInterestRepository.castVote(interestId, currentUser.id);
      setItems((prev) =>
        prev.map((item) =>
          item.interest.id === interestId
            ? {
                ...item,
                userVoted: true,
                voteCount: item.voteCount + 1,
              }
            : item
        )
      );
    } catch (error) {
      console.error("Failed to cast vote:", error);
    } finally {
      setVotingInterestId(null);
    }
  };

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        (a.walker.name || "").localeCompare(b.walker.name || "")
      ),
    [items]
  );

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!userData?.campaignId) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600 dark:text-gray-400">
          Join or create a campaign to see interested walkers.
        </p>
      </div>
    );
  }

  if (sortedItems.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p className="text-gray-600 dark:text-gray-400">
          No walkers have expressed interest yet.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Interested Walkers
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Review walker profiles and vote for your preferred option.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedItems.map((item) => {
          const isVoting = votingInterestId === item.interest.id;
          return (
            <div key={item.interest.id} className="h-full">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 h-full">
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {item.walker.name}
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      {item.walker.walkerProfile?.suburb || item.walker.location}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <strong>Rate:</strong> ${
                        item.walker.walkerProfile?.ratePerDoor || 0
                      }/door
                    </p>
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <strong>Service radius:</strong>{" "}
                      {item.walker.walkerProfile?.serviceRadiusKm || 0} km
                    </p>
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700" />

                  <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      Votes: <strong>{item.voteCount}</strong>
                    </p>

                    <div className="flex gap-2">
                      <RouterLink
                        to={`/walker/${item.walker.id}`}
                        className="px-4 py-2 border border-emerald-600 text-emerald-600 dark:text-emerald-400 dark:border-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors text-center"
                      >
                        View profile
                      </RouterLink>
                      <button
                        disabled={item.userVoted || isVoting}
                        onClick={() => handleVote(item.interest.id)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                      >
                        {item.userVoted ? "Voted" : "Vote"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WalkersPage;
