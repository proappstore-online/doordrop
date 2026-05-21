import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { DoorRepository } from "../../repositories/doorRepository";
import { PrintoutRepository } from "../../repositories/printoutRepository";
import { WalkerInterestRepository } from "../../repositories/walkerInterestRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import type { CampaignData } from "../../models/campaign";
import type { DoorData } from "../../models/door";
import type { PrintoutData } from "../../models/printout";
import CampaignNotices from "../../components/campaign/CampaignNotices";
import { CampaignNoteRepository, type CampaignNote } from "../../repositories/campaignNoteRepository";
import Notes from "../UserInfoPage/Dashboard/Notes";
import CampaignSharedView from "./components/CampaignSharedView";

const DOORS_POLL_MS = 5000;

const WalkerCampaignDetailPage: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { currentUser } = useAuthContext();
  const [campaign, setCampaign] = useState<(CampaignData & { id: string }) | null>(null);
  const [doors, setDoors] = useState<(DoorData & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isInterested, setIsInterested] = useState(false);
  const [savingInterest, setSavingInterest] = useState(false);
  const [printouts, setPrintouts] = useState<(PrintoutData & { id: string })[]>([]);

  const [notes, setNotes] = useState<CampaignNote[]>([]);
  const [noteInput, setNoteInput] = useState("");
  const [noteLoading, setNoteLoading] = useState(false);

  const isAssignedWalker = campaign?.assignedWalkerId === currentUser?.id;
  const isCampaignClosed =
    campaign?.status === "complete" ||
    campaign?.status === "review" ||
    campaign?.status === "payment" ||
    campaign?.status === "archive";

  // Load campaign + printouts + interest state
  useEffect(() => {
    if (!campaignId || !currentUser) return;
    const load = async () => {
      setLoading(true);
      try {
        const [campaignData, printoutsData] = await Promise.all([
          CampaignRepository.getGroup(campaignId),
          PrintoutRepository.getVersions(campaignId),
        ]);
        setCampaign(campaignData);
        setPrintouts(printoutsData);

        const interest = await WalkerInterestRepository.getInterestByWalkerAndGroup(
          currentUser.id,
          campaignId,
        );
        setIsInterested(!!interest);
      } catch (err) {
        console.error("Failed to load campaign:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [campaignId, currentUser]);

  // Poll doors (replaces Firestore onSnapshot).
  useEffect(() => {
    if (!campaignId) return;
    let cancelled = false;
    const fetchDoors = async () => {
      try {
        const updated = await DoorRepository.getDoorsByCampaign(campaignId);
        if (!cancelled) setDoors(updated);
      } catch {
        /* swallow */
      }
    };
    void fetchDoors();
    const interval = setInterval(() => void fetchDoors(), DOORS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [campaignId]);

  // Campaign chat — polling stub today (task #10 swaps to fas.rooms).
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
    setSavingInterest(true);
    try {
      await WalkerInterestRepository.createInterest({
        walkerId: currentUser.id,
        campaignId,
        createdAt: new Date(),
      });
      setIsInterested(true);
    } catch (err) {
      console.error("Failed to express interest:", err);
    } finally {
      setSavingInterest(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="max-w-2xl mx-auto p-4">
        <p className="text-gray-600 dark:text-gray-400">Campaign not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <CampaignNotices
        campaignStatus={campaign.status}
        isCampaignClosed={isCampaignClosed}
        isWalker={true}
        isAssignedWalker={isAssignedWalker}
      />

      {isAssignedWalker && !isCampaignClosed && (
        <Link
          to={`/walker/campaign/${campaignId}/deliver`}
          className="block w-full text-center px-6 py-4 bg-emerald-600 hover:bg-emerald-700 text-white text-lg font-semibold rounded-xl transition-colors no-underline shadow-lg"
        >
          Start Delivery
        </Link>
      )}

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

      {isAssignedWalker && (
        <Notes
          notes={notes}
          noteInput={noteInput}
          noteLoading={noteLoading}
          onNoteChange={setNoteInput}
          onAddNote={handleAddNote}
          formatDate={(date) => new Date(date).toLocaleString()}
        />
      )}

      {!isAssignedWalker && !isCampaignClosed && (
        <button
          onClick={handleExpressInterest}
          disabled={isInterested || savingInterest}
          className={`${
            isInterested
              ? "border border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          } font-medium py-2 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isInterested ? "Interested" : "Express Interest"}
        </button>
      )}
    </div>
  );
};

export default WalkerCampaignDetailPage;
