export type NotificationType = "walker_interested" | "walker_assigned";

export type NotificationData = {
  type: NotificationType;
  title: string;
  body: string;
  campaignId?: string;
  read: boolean;
  createdAt: Date;
};
