import { useState } from "react";
import { PrintoutRepository } from "../repositories/printoutRepository";
import type { PrintoutData } from "../models/printout";
import { uploadFile } from "../utils/storageUpload";

export interface UsePrintoutManagementReturn {
  // Form state
  showPrintoutForm: boolean;
  printoutName: string;
  printoutDesc: string;
  printoutFile: File | null;
  printoutFilePreview: string | null;
  savingPrintout: boolean;

  // Setters
  setShowPrintoutForm: (show: boolean) => void;
  setPrintoutName: (name: string) => void;
  setPrintoutDesc: (desc: string) => void;
  setPrintoutFile: (file: File | null) => void;
  setPrintoutFilePreview: (preview: string | null) => void;

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

  const handleCreatePrintout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignId || !currentUserId || !printoutName.trim()) return;
    setSavingPrintout(true);
    try {
      let fileUrl: string | undefined;
      if (printoutFile) {
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
      await PrintoutRepository.createVersion(campaignId, printoutData as any);
      const updated = await PrintoutRepository.getVersions(campaignId);
      setPrintouts(updated);
      setPrintoutName("");
      setPrintoutDesc("");
      setPrintoutFile(null);
      setPrintoutFilePreview(null);
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
    savingPrintout,
    setShowPrintoutForm,
    setPrintoutName,
    setPrintoutDesc,
    setPrintoutFile,
    setPrintoutFilePreview,
    handleCreatePrintout,
  };
}
