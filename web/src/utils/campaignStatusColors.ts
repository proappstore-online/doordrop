import type { CampaignStatus } from "../models/campaign";

export const campaignStatusColors: Record<CampaignStatus, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
  ready: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  assigned: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200",
  complete: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200",
  review: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200",
  payment: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200",
  archive: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
};
