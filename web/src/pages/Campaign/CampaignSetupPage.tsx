import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CampaignRepository } from "../../repositories/campaignRepository";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useCampaignDraft } from "../../hooks/useCampaignDraft";
import StepIndicator from "../../components/campaign/StepIndicator";
import LocationStep from "../../components/campaign/steps/LocationStep";
import DeliveryAreaStep from "../../components/campaign/steps/DeliveryAreaStep";
import FlyerStep from "../../components/campaign/steps/FlyerStep";
import ScheduleBudgetStep from "../../components/campaign/steps/ScheduleBudgetStep";
import ReviewStep from "../../components/campaign/steps/ReviewStep";
import type { CampaignData } from "../../models/campaign";

type StepId = "location" | "delivery" | "flyer" | "schedule" | "review";

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "location", label: "Location" },
  { id: "delivery", label: "Delivery Area" },
  { id: "flyer", label: "Flyer" },
  { id: "schedule", label: "Schedule & Budget" },
  { id: "review", label: "Review" },
];

const CampaignSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthContext();
  const { draft, isLoaded, saveDraft, clearDraft } = useCampaignDraft(currentUser?.id);

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [campaignData, setCampaignData] = useState<Partial<CampaignData>>({
    planType: "roster",
    adminIds: currentUser ? [currentUser.id] : [],
    createdAt: new Date(),
    country: "AU",
  });
  const [campaignId, setCampaignId] = useState<string | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore draft on mount
  useEffect(() => {
    if (!isLoaded || !draft) return;

    const stepIndex = Math.min(draft.currentStep - 1, STEPS.length - 1);
    setCurrentStepIndex(stepIndex);
    setCampaignData(draft.data);
    if (draft.campaignId) {
      setCampaignId(draft.campaignId);
    }
  }, [isLoaded, draft]);

  const currentStep = STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === STEPS.length - 1;

  // Validation logic for each step
  const isStepValid = useCallback((): boolean => {
    switch (currentStep.id) {
      case "location":
        return Boolean(campaignData.state && campaignData.suburb && campaignData.postcode);
      case "delivery":
        return Boolean(campaignData.doorRadiusM && campaignData.doorRadiusM > 0);
      case "flyer":
        return Boolean(campaignData.activePrintoutId);
      case "schedule":
        return Boolean(campaignData.dueDate && campaignData.budget !== undefined && campaignData.budget > 0);
      case "review":
        return true; // Review step doesn't block
      default:
        return false;
    }
  }, [currentStep.id, campaignData]);

  const handleNext = async () => {
    if (!isStepValid()) {
      setError(`Please complete all required fields on Step ${currentStepIndex + 1}`);
      return;
    }

    setError(null);

    // Create campaign after step 1 (location)
    if (currentStep.id === "location" && !campaignId && currentUser) {
      setIsCreating(true);
      try {
        const displaySuburb = (campaignData.suburb || "").trim().toLowerCase();
        const displayPostcode = (campaignData.postcode || "").trim();

        // Geocode to get coordinates (simplified - using placeholder coords)
        const name = `${displaySuburb} ${displayPostcode}`;
        const nameKey = `${displaySuburb} ${displayPostcode.toLowerCase()}`;

        const newCampaignId = await CampaignRepository.createGroup({
          name,
          nameKey,
          suburb: displaySuburb,
          postcode: displayPostcode,
          state: campaignData.state,
          country: "AU",
          planType: "roster",
          adminIds: [currentUser.id],
          createdAt: new Date(),
          memberIds: [currentUser.id],
          status: "draft",
          lat: 0,
          lng: 0,
        });

        setCampaignId(newCampaignId);

        // Save draft with campaign ID
        saveDraft(currentStepIndex + 2, campaignData, newCampaignId);
      } catch (err) {
        console.error("Failed to create campaign:", err);
        setError("Failed to create campaign. Please try again.");
        setIsCreating(false);
        return;
      }
      setIsCreating(false);
    } else {
      // Save draft after other steps
      saveDraft(currentStepIndex + 2, campaignData, campaignId);
    }

    // Move to next step
    setCurrentStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setError(null);
    setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSaveDraft = () => {
    if (campaignId) {
      saveDraft(currentStepIndex + 1, campaignData, campaignId);
      setError(null);
      navigate("/app");
    }
  };

  const handlePublish = async () => {
    if (!campaignId) {
      setError("Campaign ID not found");
      return;
    }

    if (!isStepValid()) {
      setError("Please complete all required fields before publishing");
      return;
    }

    setIsPublishing(true);
    setError(null);
    try {
      // Update campaign to published state
      await CampaignRepository.updateGroup(campaignId, {
        status: "ready",
        ...campaignData,
      });

      // Clear draft
      clearDraft();

      // Navigate to campaign detail
      navigate(`/app/campaign/${campaignId}`);
    } catch (err) {
      console.error("Failed to publish campaign:", err);
      setError("Failed to publish campaign. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleDataChange = (newData: Partial<CampaignData>) => {
    setCampaignData((prev) => ({ ...prev, ...newData }));
  };

  if (!isLoaded) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Create a Campaign</h1>
        <p className="text-gray-600 dark:text-gray-400">Set up your campaign step by step</p>
      </div>

      <StepIndicator steps={STEPS} currentStep={currentStepIndex + 1} />

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
          <p className="text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        {currentStep.id === "location" && (
          <LocationStep data={campaignData} onChange={handleDataChange} isLoading={isCreating} />
        )}
        {currentStep.id === "delivery" && (
          <DeliveryAreaStep data={campaignData} onChange={handleDataChange} isLoading={isPublishing} />
        )}
        {currentStep.id === "flyer" && (
          <FlyerStep data={campaignData} onChange={handleDataChange} currentUserId={currentUser?.id} isLoading={isPublishing} />
        )}
        {currentStep.id === "schedule" && (
          <ScheduleBudgetStep data={campaignData} onChange={handleDataChange} isLoading={isPublishing} />
        )}
        {currentStep.id === "review" && <ReviewStep data={campaignData} />}
      </div>

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {!isFirstStep && (
          <button
            type="button"
            onClick={handleBack}
            disabled={isCreating || isPublishing}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors disabled:opacity-50"
          >
            ← Back
          </button>
        )}

        {!isLastStep && (
          <button
            type="button"
            onClick={handleNext}
            disabled={isCreating || isPublishing || !isStepValid()}
            className="flex-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating..." : "Continue →"}
          </button>
        )}

        {isLastStep && (
          <>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isPublishing}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isPublishing || !isStepValid()}
              className="flex-1 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isPublishing ? "Publishing..." : "Publish Campaign"}
            </button>
          </>
        )}
      </div>

      {/* Info message */}
      {!isLastStep && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Your progress is saved automatically. You can come back to finish later.
        </p>
      )}
    </div>
  );
};

export default CampaignSetupPage;
