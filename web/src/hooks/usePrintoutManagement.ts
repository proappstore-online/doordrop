import { useEffect, useState } from "react";
import { PrintoutRepository } from "../repositories/printoutRepository";
import { FlyerRepository, type FlyerWithId } from "../repositories/flyerRepository";
import type { PrintoutData } from "../models/printout";
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

  // Setters
  setShowPrintoutForm: (show: boolean) => void;
  setPrintoutName: (name: string) => void;
  setPrintoutDesc: (desc: string) => void;
  setPrintoutFile: (file: File | null) => void;
  setPrintoutFilePreview: (preview: string | null) => void;
  selectFlyer: (flyerId: string) => void;

  // Handler
  handleCreatePrintout: (e: React.FormEvent) => Promise<void>;
}

export function usePrintoutManagement(
  campaignId: string | undefined,
  currentUserId: string | undefined,
  setPrintouts: React.Dispatch<React.SetStateAction<(PrintoutData & { id: string })[]>>
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
      await PrintoutRepository.createVersion(campaignId, printoutData as any);
      const updated = await PrintoutRepository.getVersions(campaignId);
      setPrintouts(updated);
      setPrintoutName("");
      setPrintoutDesc("");
      setPrintoutFile(null);
      setPrintoutFilePreview(null);
      setSelectedFlyerId("");
      setShowPrintoutForm(false);
    } catch (err) {
      console.error("Failed to create printout version:", err);
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
    setShowPrintoutForm,
    setPrintoutName,
    setPrintoutDesc,
    setPrintoutFile,
    setPrintoutFilePreview,
    selectFlyer,
    handleCreatePrintout,
  };
}
