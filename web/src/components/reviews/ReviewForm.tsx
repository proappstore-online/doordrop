import React, { useState } from "react";
import StarRating from "./StarRating";
import { WalkerReviewRepository } from "../../repositories/walkerReviewRepository";
import type { WalkerReview } from "../../models/walkerReview";

type ReviewFormProps = {
  walkerId: string;
  reviewerId: string;
  reviewerName?: string;
  campaignId: string;
  scheduleId?: string;
  onSubmitted?: () => void;
  onCancel?: () => void;
};

const ReviewForm: React.FC<ReviewFormProps> = ({
  walkerId,
  reviewerId,
  reviewerName,
  campaignId,
  scheduleId,
  onSubmitted,
  onCancel,
}) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg(null);

    if (rating < 1 || rating > 5) {
      setErrorMsg("Please select a rating between 1 and 5.");
      return;
    }

    setLoading(true);
    try {
      if (scheduleId) {
        const existing = await WalkerReviewRepository.getReviewByScheduleAndReviewer(
          walkerId,
          scheduleId,
          reviewerId
        );
        if (existing) {
          setErrorMsg("You already reviewed this job.");
          return;
        }
      }

      const payload: WalkerReview = {
        walkerId,
        reviewerId,
        reviewerName,
        campaignId,
        scheduleId,
        rating,
        comment: comment.trim() || undefined,
        createdAt: new Date(),
      };

      await WalkerReviewRepository.createReview(walkerId, payload);
      onSubmitted?.();
    } catch (error) {
      console.error("Failed to submit review", error);
      setErrorMsg("Failed to submit review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-2 space-y-4">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
        How was the delivery?
      </h3>
      <StarRating value={rating} onChange={setRating} />
      <div>
        <label
          htmlFor="comment"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Comments (optional)
        </label>
        <textarea
          id="comment"
          rows={3}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          placeholder="Share your experience..."
        />
      </div>
      {errorMsg && (
        <p className="text-red-600 dark:text-red-400">{errorMsg}</p>
      )}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {loading ? "Submitting..." : "Submit Review"}
        </button>
      </div>
    </form>
  );
};

export default ReviewForm;
