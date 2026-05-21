export type PlanType = "scheduled" | "completed";

export type DeliveryRunData = {
    date: Date;
    status?: PlanType;
    walkerId?: string | null;
    createdAt: Date;
    updatedAt?: Date;
    campaignId: string;
};
