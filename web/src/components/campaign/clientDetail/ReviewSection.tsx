import React from "react";
import ReviewForm from "../../reviews/ReviewForm";
import ReviewPrompt from "../../reviews/ReviewPrompt";

interface ReviewSectionProps {
  walkerId: string;
  walkerName?: string;
  reviewerId: string;
  reviewerName?: string;
  campaignId: string;
  /** Localised completion date, shown on the prompt. */
  completedDate?: string;
  showForm: boolean;
  onRateNow: () => void;
  onSubmitted: () => void;
  onCancel: () => void;
}

/** The admin's prompt to review the walker once a campaign is complete, or the review form itself. */
const ReviewSection: React.FC<ReviewSectionProps> = ({
  walkerId,
  walkerName,
  reviewerId,
  reviewerName,
  campaignId,
  completedDate,
  showForm,
  onRateNow,
  onSubmitted,
  onCancel,
}) =>
  showForm ? (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <ReviewForm
        walkerId={walkerId}
        reviewerId={reviewerId}
        reviewerName={reviewerName}
        campaignId={campaignId}
        scheduleId={campaignId}
        onSubmitted={onSubmitted}
        onCancel={onCancel}
      />
    </div>
  ) : (
    <ReviewPrompt onRateNow={onRateNow} completedDate={completedDate} walkerName={walkerName} />
  );

export default ReviewSection;
