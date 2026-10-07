import { pas } from "./pas";
import type { CampaignData } from "../models/campaign";

// Web Push via pas.notifications. Targeted sends from an app worker are not
// possible (no credential; `send` is creator-only), so the sender's browser
// calls notifyUser after the in-app notification action succeeds. The sender
// must itself be subscribed to push for the platform to accept the call.

export function isSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function isPushEnabled(): Promise<boolean> {
  return isSupported() && Notification.permission === "granted" && (await pas.notifications.isSubscribed());
}

/** Must be called from a user gesture (permission prompt). */
export async function enablePush(): Promise<boolean> {
  if (!isSupported()) return false;
  try {
    await pas.notifications.subscribe("/sw.js");
    return true;
  } catch (err) {
    console.error("Push subscribe failed:", err);
    return false;
  }
}

export async function disablePush(): Promise<void> {
  try {
    await pas.notifications.unsubscribe();
  } catch (err) {
    console.error("Push unsubscribe failed:", err);
  }
}

async function notifyBestEffort(userIds: string[], payload: { title: string; body: string; url: string; tag: string }) {
  if (!isSupported() || Notification.permission !== "granted") return;
  await Promise.all(
    userIds.map((id) => pas.notifications.notifyUser(id, payload).catch((err) => console.warn("Push notify failed:", err))),
  );
}

/** Walker expressed interest: push to the campaign admins (except the walker). */
export function pushWalkerInterested(campaign: Pick<CampaignData, "name" | "adminIds"> & { id: string }, walkerId: string, walkerName: string) {
  return notifyBestEffort(
    campaign.adminIds.filter((id) => id !== walkerId),
    {
      title: "New walker interested",
      body: `${walkerName} wants to deliver for ${campaign.name}`,
      url: `/app/campaign/${campaign.id}`,
      tag: `interest-${campaign.id}`,
    },
  );
}

/** Admin assigned a walker: push to the walker. */
export function pushWalkerAssigned(campaignId: string, walkerId: string) {
  return notifyBestEffort([walkerId], {
    title: "You've been assigned!",
    body: "You've been assigned to a campaign",
    url: `/walker/campaign/${campaignId}`,
    tag: `assigned-${campaignId}`,
  });
}
