import React, { useCallback, useEffect, useRef, useState } from "react";
import StarRating from "./StarRating";
import { WalkerReviewRepository, type PaginationCursor } from "../../repositories/walkerReviewRepository";
import type { WalkerReview } from "../../models/walkerReview";

interface ReviewListProps {
  walkerId: string;
}

const ReviewList: React.FC<ReviewListProps> = ({ walkerId }) => {
  const [reviews, setReviews] = useState<(WalkerReview & { id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<PaginationCursor | undefined>(undefined);

  const loadReviews = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const { reviews: nextReviews, lastDoc: nextLast } = await WalkerReviewRepository.getReviewsForWalker(
        walkerId,
        10,
        reset ? undefined : lastDocRef.current
      );

      setReviews((prev) => (reset ? nextReviews : [...prev, ...nextReviews]));
      lastDocRef.current = nextLast;
      setHasMore(nextReviews.length === 10);
    } finally {
      setLoading(false);
    }
  }, [walkerId]);

  useEffect(() => {
    setReviews([]);
    lastDocRef.current = undefined;
    setHasMore(true);
    if (walkerId) {
      loadReviews(true);
    }
  }, [walkerId, loadReviews]);

  return (
    <div>
      {reviews.length === 0 && !loading ? (
        <p className="text-gray-600 dark:text-gray-400">No reviews yet.</p>
      ) : (
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {reviews.map((review) => (
            <div key={review.id} className="py-4 first:pt-0">
              <div className="flex items-center gap-4 mb-2">
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  {review.reviewerName || "Resident"}
                </p>
                <StarRating value={review.rating} readOnly size="small" />
              </div>
              <div className="space-y-1">
                {review.comment && (
                  <p className="text-gray-700 dark:text-gray-300">{review.comment}</p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {review.createdAt instanceof Date
                    ? review.createdAt.toLocaleDateString()
                    : new Date(review.createdAt as any).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => loadReviews()}
            disabled={loading}
            className="px-4 py-2 border border-emerald-600 text-emerald-600 dark:text-emerald-400 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors"
          >
            {loading ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewList;
