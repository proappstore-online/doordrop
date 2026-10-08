import { useEffect, useState } from "react";
import { PrintoutRepository } from "../repositories/printoutRepository";
import { FlyerRepository, type FlyerWithId } from "../repositories/flyerRepository";
import { CampaignRepository } from "../repositories/campaignRepository";
import type { PrintoutData } from "../models/printout";
import type { CampaignData } from "../models/campaign";
import { uploadFile } from "../utils/storageUpload";

export interface UsePrintoutManagementReturn {
  // Form state
  showPrintoutForm: boolean;
  printoutName: string;
  printoutDesc: string;
  printoutFile: File | null;
  printoutFilePreview: string | null;
  flyers: FlyerWithId[];
  flyersLoading: boolean;
  selectedFlyerId: string;
  savingPrintout: boolean;
  printoutError: string | null;

  // Setters
  setShowPrintoutForm: (show: boolean) => void;
  setPrintoutName: (name: string) => void;
  setPrintoutDesc: (desc: string) => void;
  setPrintoutFile: (file: File | null) => void;
  setPrintoutFilePreview: (preview: string | null) => void;
  selectFlyer: (flyerId: string) => void;
  dismissError: () => void;

  // Handler
  handleCreatePrintout: (e: React.FormEvent) => Promise<void>;
}

export function usePrintoutManagement(
  campaignId: string | undefined,
  currentUserId: string | undefined,
  setPrintouts: React.Dispatch<React.SetStateAction<(PrintoutData & { id: string })[]>>,
  currentActivePrintoutId?: string | null,
  onCampaignUpdate?: (update: Partial<CampaignData>) => void
): UsePrintoutManagementReturn {
  const [showPrintoutForm, setShowPrintoutForm] = useState(false);
  const [printoutName, setPrintoutName] = useState("");
  const [printoutDesc, setPrintoutDesc] = useState("");
  const [savingPrintout, setSavingPrintout] = useState(false);
  const [printoutFile, setPrintoutFile] = useState<File | null>(null);
  const [printoutFilePreview, setPrintoutFilePreview] = useState<string | null>(null);
  const [flyers, setFlyers] = useState<FlyerWithId[]>([]);
  const [flyersLoading, setFlyersLoading] = useState(false);
  const [selectedFlyerId, setSelectedFlyerId] = useState("");
  const [printoutError, setPrintoutError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUserId) {
      setFlyers([]);
      return;
    }

    let cancelled = false;
    setFlyersLoading(true);
    FlyerRepository.getFlyers(currentUserId)
      .then((loadedFlyers) => {
        if (!cancelled) setFlyers(loadedFlyers);
      })
      .catch((err) => {
        console.error("Failed to load flyer library:", err);
        if (!cancelled) setFlyers([]);
      })
      .finally(() => {
        if (!cancelled) setFlyersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId]);

  const selectFlyer = (flyerId: string) => {
    setSelectedFlyerId(flyerId);
    const flyer = flyers.find((candidate) => candidate.id === flyerId);
    if (!flyer) return;

    setPrintoutName(flyer.name);
    setPrintoutDesc(flyer.description || "");
    setPrintoutFile(null);
    setPrintoutFilePreview(null);
  };

  const handleCreatePrintout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !currentUserId || !printoutName.trim()) return;
    setSavingPrintout(true);
    setPrintoutError(null);
    try {
      const selectedFlyer = flyers.find((flyer) => flyer.id === selectedFlyerId);
      let fileUrl = selectedFlyer?.fileUrl;
      if (!selectedFlyer && printoutFile) {
        const ext = printoutFile.name.split(".").pop() || "jpg";
        fileUrl = await uploadFile(`campaigns/${campaignId}/printouts/${Date.now()}.${ext}`, printoutFile);
      }
      const printoutData: Record<string, any> = {
        name: printoutName.trim(),
        createdAt: new Date(),
        createdBy: currentUserId,
      };
      if (printoutDesc.trim()) printoutData.description = printoutDesc.trim();
      if (fileUrl) printoutData.fileUrl = fileUrl;
      if (selectedFlyer) printoutData.flyerId = selectedFlyer.id;

      // Create the printout
      const printoutId = await PrintoutRepository.createVersion(campaignId, printoutData as any);
      const updated = await PrintoutRepository.getVersions(campaignId);
      setPrintouts(updated);

      // If this is the first printout and no active flyer is set, make it active
      if (updated.length === 1 && !currentActivePrintoutId) {
        try {
          await CampaignRepository.updateGroup(campaignId, { activePrintoutId: printoutId });
          if (onCampaignUpdate) {
            onCampaignUpdate({ activePrintoutId: printoutId });
          }
        } catch (updateErr) {
          console.error("Failed to set first flyer as active:", updateErr);
          // Don't block the flow if activation fails; the user can manually select it
          setPrintoutError("We couldn't automatically activate the flyer as default, but it was saved. You can select it manually.");
        }
      }

      setPrintoutName("");
      setPrintoutDesc("");
      setPrintoutFile(null);
      setPrintoutFilePreview(null);
      setSelectedFlyerId("");
      setShowPrintoutForm(false);
    } catch (err) {
      console.error("Failed to create printout version:", err);
      setPrintoutError("We couldn't save this flyer. Please try again.");
    } finally {
      setSavingPrintout(false);
    }
  };

  return {
    showPrintoutForm,
    printoutName,
    printoutDesc,
    printoutFile,
    printoutFilePreview,
    flyers,
    flyersLoading,
    selectedFlyerId,
    savingPrintout,
    printoutError,
    setShowPrintoutForm,
    setPrintoutName,
    setPrintoutDesc,
    setPrintoutFile,
    setPrintoutFilePreview,
    selectFlyer,
    dismissError: () => setPrintoutError(null),
    handleCreatePrintout,
  };
}
