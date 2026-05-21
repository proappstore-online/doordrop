export type PropertyReportReason = "no_house" | "construction" | "angry_owner" | "no_junk_mail" | "other";

export type PropertyReport = {
  reason: PropertyReportReason;
  photoUrl?: string;
  notes?: string;
  reportedAt: Date;
  reportedBy: string;
  campaignId?: string;
};

export type PropertyData = {
  address: string;
  streetName: string;
  houseNumber: string;
  suburb: string;
  postcode: string;
  state: string;
  lat?: number;
  lng?: number;
  commercial?: boolean;
  accessUserIds: string[];
  createdAt: Date;
};
