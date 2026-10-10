import React, { useEffect, useState } from "react";
import { useApp } from "@proappstore/sdk";
import { pushWalkerInterested } from "../../services/pushNotifications";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { PrintoutRepository } from "../../repositories/printoutRepository";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import type { CampaignData } from "../../models/campaign";
import type { DoorData } from "../../models/door";
import type { PrintoutData } from "../../models/printout";
import type { WalkerInterest } from "../../models/walkerInterest";
import { CampaignNoteRepository, type CampaignNote } from "../../repositories/campaignNoteRepository";
import Notes from "../UserInfoPage/Dashboard/Notes";
import CampaignSharedView from "./components/CampaignSharedView";
import MobilePageHeader from "../../components/mobile/MobilePageHeader";
import StickyActionBar from "../../components/mobile/StickyActionBar";
import StatusChip from "../../components/mobile/StatusChip";

const DOORS_FALLBACK_POLL_MS = 30000;

const WalkerCampaignDetailPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<(CampaignData & { id: string }) | null>(null);
  const [doors, setDoors] = useState<(DoorData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [interest, setInterest] = useState<(WalkerInterest & { id: string }) | null>(null);
  const [submittingInterest, setSubmittingInterest] = useState(false);
  const [printouts, setPrintouts] = useState<(PrintoutData & { id: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const isAssignedWalker = campaign?.assignedWalkerId === currentUser?.id;
  const isCampaignClosed =
    campaign?.status === "complete" ||
    campaign?.status === "review" ||
    campaign?.status === "payment" ||
    campaign?.status === "archive";

  const loadCampaignData = async () => {
    if (!campaignId || !currentUser) return;
    setLoading(true);
    setError(null);
    try {
      const [campaignData, printoutsData, interestData] = await Promise.all([
        CampaignRepository.getGroup(campaignId),
        PrintoutRepository.getVersions(campaignId),
        WalkerInterestRepository.getInterestByWalkerAndGroup(currentUser.id, campaignId),
      ]);
      setCampaign(campaignData);
      setPrintouts(printoutsData);
      setInterest(interestData);
    } catch (err) {
      console.error("Failed to load campaign:", err);
      setError("Failed to load campaign. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaignData();
  }, [campaignId, currentUser]);

  // Live doors via campaign room events with fallback polling.
  // Door updates come via door.changed events published to campaign:{id} room.
  const app = useApp() as any;
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    let fallbackInterval: ReturnType<typeof setInterval> | null = null;

    const fetchDoors = async () => {
      if (cancelled) return;
      try {
        const updated = await DoorRepository.getDoorsByCampaign(campaignId);
        if (!cancelled) setDoors(updated);
      } catch {
        /* swallow */
      }
    };

    const room = app?.rooms?.join(`campaign:${campaignId}`);

    if (room) {
      // Listen to door.changed events only
      const unsubscribe = room.onEvent((event: any) => {
        if (event.data?.type === 'door.changed' && event.data?.campaignId === campaignId) {
          void fetchDoors();
        }
      });

      // Refetch on reconnect (missed events during disconnect)
      const unsubscribeReconnect = room.onReconnect(() => {
        void fetchDoors();
      });

      // Fallback polling when disconnected
      const unsubscribeState = room.onConnectionState((state: string) => {
        if (state === 'closed' || state === 'error') {
          if (!fallbackInterval) {
            fallbackInterval = setInterval(() => void fetchDoors(), DOORS_FALLBACK_POLL_MS);
          }
        } else {
          if (fallbackInterval) {
            clearInterval(fallbackInterval);
            fallbackInterval = null;
          }
        }
      });

      void fetchDoors(); // Initial load
      return () => {
        cancelled = true;
        unsubscribe();
        unsubscribeReconnect();
        unsubscribeState();
        room.close();
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    } else {
      // Fallback to polling if rooms unavailable
      void fetchDoors();
      fallbackInterval = setInterval(() => void fetchDoors(), DOORS_FALLBACK_POLL_MS);
      return () => {
        cancelled = true;
        if (fallbackInterval) clearInterval(fallbackInterval);
      };
    }
  }, [campaignId, app]);

  useEffect(() => {
    if (!campaignId || !isAssignedWalker) return;
    const unsub = CampaignNoteRepository.subscribeToNotes(campaignId, setNotes);
    return unsub;
  }, [campaignId, isAssignedWalker]);

  const handleAddNote = async () => {
    if (!noteInput.trim() || !campaignId || !currentUser) return;
    setNoteLoading(true);
    try {
      const userName = currentUser.login || "Walker";
      await CampaignNoteRepository.addNote(campaignId, noteInput, userName, currentUser.id);
      setNoteInput("");
    } catch (err) {
      console.error("Failed to add note:", err);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleExpressInterest = async () => {
    if (!currentUser || !campaignId) return;
    setSubmittingInterest(true);
    try {
      const interestId = await WalkerInterestRepository.createInterest({
        walkerId: currentUser.id,
        campaignId,
        status: "pending",
        createdAt: new Date(),
      });
      setInterest({
        id: interestId,
        walkerId: currentUser.id,
        campaignId,
        status: "pending",
        createdAt: new Date(),
      });
      if (campaign) void pushWalkerInterested(campaign, currentUser.id, currentUser.login || "A walker");
    } catch (err) {
      console.error("Failed to express interest:", err);
      setError("Failed to express interest. Please try again.");
    } finally {
      setSubmittingInterest(false);
    }
  };

  const handleWithdrawInterest = async () => {
    if (!interest?.id) return;
    setSubmittingInterest(true);
    try {
      await WalkerInterestRepository.withdrawInterest(interest.id);
      setInterest(null);
    } catch (err) {
      console.error("Failed to withdraw interest:", err);
      setError("Failed to withdraw interest. Please try again.");
    } finally {
      setSubmittingInterest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-600 dark:text-gray-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">Campaign not found.</p>
          <Link
            to="/walker/campaigns"
            className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
          >
            Back to campaigns
          </Link>
        </div>
      </div>
    );
  }

  const printout = printouts[0];
  const doorsDelivered = doors.filter((d) => d.deliveredAt).length;
  const interestStatus = interest?.status;
  const isPending = interestStatus === "pending";
  const isAssigned = interestStatus === "assigned";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Loading campaign details...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Campaign not found
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This campaign may have been removed or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/walker')}
            className="inline-block h-11 px-6 text-sm font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-600 dark:border-emerald-400 rounded hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pb-32">
      <MobilePageHeader
        title={campaign.name}
        subtitle={`${campaign.suburb} ${campaign.postcode}`}
        onBack={() => navigate(-1)}
        showBackButton={true}
        actions={
          <StatusChip
            label={campaign.status}
            variant={
              campaign.status === 'complete' ? 'success'
              : campaign.status === 'ready' ? 'info'
              : 'neutral'
            }
            size="sm"
          />
        }
      />

      {/* Error banner */}
      {error && (
        <div className="mx-4 mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
            <button
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-400 hover:text-red-700 flex-shrink-0"
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-6 sm:px-6 space-y-6">
        {/* Key stats row */}
        <div className="grid grid-cols-2 gap-3 bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          {campaign.totalDoors != null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Doors</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {isAssignedWalker ? `${doorsDelivered}/${campaign.totalDoors}` : campaign.totalDoors}
              </p>
            </div>
          )}
          {campaign.budget != null && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Pay</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">${campaign.budget}</p>
            </div>
          )}
          {campaign.dueDate && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Due</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {new Date(campaign.dueDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
          )}
          {campaign.doorRadiusM && (
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase font-medium mb-1">Radius</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{campaign.doorRadiusM}m</p>
            </div>
          )}
        </div>

        {/* Flyer section */}
        {printout && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Flyer</h3>
            <div className="flex gap-4 items-start">
              {printout.fileUrl && (
                <img
                  src={printout.fileUrl}
                  alt="Flyer"
                  className="w-24 h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
              )}
              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-gray-100 mb-1">{printout.name}</p>
                {printout.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{printout.description}</p>
                )}
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Version: <span className="font-medium">{printout.version}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Junk mail and property filter info */}
        {(campaign.junkMailPolicy || campaign.propertyFilter) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Delivery Preferences</h3>
            <ul className="space-y-2">
              {campaign.junkMailPolicy && (
                <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">✓</span>
                  <span>
                    Junk mail: <span className="font-medium">{campaign.junkMailPolicy === "deliver" ? "Deliver all" : "Skip"}</span>
                  </span>
                </li>
              )}
              {campaign.propertyFilter && (
                <li className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span className="text-emerald-600 dark:text-emerald-400 flex-shrink-0">✓</span>
                  <span>
                    Property types: <span className="font-medium capitalize">{campaign.propertyFilter}</span>
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Doors list */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Delivery Locations ({doors.length})
            </h3>
          </div>
          {doors.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400">No doors loaded yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {doors.slice(0, 20).map((door) => (
                <div key={door.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-gray-100">{door.address}</p>
                    {door.deliveryCount ? (
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Delivered {door.deliveryCount} time{door.deliveryCount !== 1 ? "s" : ""}
                      </p>
                    ) : null}
                  </div>
                  {door.deliveredAt ? (
                    <span className="text-xs font-medium px-2.5 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-full flex-shrink-0">
                      ✓ Done
                    </span>
                  ) : (
                    <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-full flex-shrink-0">
                      Pending
                    </span>
                  )}
                </div>
              ))}
              {doors.length > 20 && (
                <div className="p-4 text-center text-sm text-gray-600 dark:text-gray-400">
                  +{doors.length - 20} more
                </div>
              )}
            </div>
          )}
        </div>

        {/* Interest CTA - Mobile sticky action bar */}
        {!isCampaignClosed && (
          <StickyActionBar
            actions={
              isAssignedWalker
                ? [
                    {
                      label: 'Start Delivery',
                      onClick: () => navigate(`/walker/campaign/${campaignId}/deliver`),
                      variant: 'primary',
                    },
                  ]
                : [
                    {
                      label: isPending ? 'Withdraw' : 'Express Interest',
                      onClick: () =>
                        isPending ? handleWithdrawInterest() : handleExpressInterest(),
                      variant: isPending ? 'secondary' : 'primary',
                      loading: submittingInterest,
                      ariaLabel: isPending
                        ? `Withdraw interest in ${campaign.name}`
                        : `Express interest in ${campaign.name}`,
                    },
                  ]
            }
          />
        )}

        {/* Notes section for assigned walkers */}
        {isAssignedWalker && (
          <div className="pb-20">
            <Notes
              notes={notes}
              noteInput={noteInput}
              noteLoading={noteLoading}
              onNoteChange={setNoteInput}
              onAddNote={handleAddNote}
              formatDate={(date) => new Date(date).toLocaleString()}
            />
          </div>
        )}

        {/* Interest status indicator */}
        {isPending && (
          <div className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <span>⏳</span>
            <span>Your interest is pending approval</span>
          </div>
        )}
        {isAssigned && (
          <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-lg">
            <span>✓</span>
            <span>You're assigned to this campaign</span>
          </div>
        )}

        {/* Fallback to full campaign view for detailed inspection */}
        <div className="hidden sm:block">
          <CampaignSharedView
            campaign={campaign}
            campaignId={campaignId!}
            doors={doors}
            printouts={printouts}
            currentUserId={currentUser?.id}
            canEditDoors={false}
            showStats={campaign.status !== "draft"}
            currentStreet={null}
            mapCenter={{ lat: -33.8688, lng: 151.2093 }}
            availableAddresses={[]}
            selectedDoorKeys={new Set()}
            walkerPosition={null}
            trackPoints={[]}
            trackStops={[]}
            shouldFollowTracker={false}
          />
        </div>
      </div>
    </div>
  );
};

export default WalkerCampaignDetailPage;
