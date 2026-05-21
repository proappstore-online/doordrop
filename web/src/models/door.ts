export type DoorStatus = "pending" | "delivered" | "reported";

export type DeliveryEvent = {
  date: Date;
  deliveredBy: string;
  printoutVersionId?: string;
  notes?: string;
};

export type DoorData = {
  address: string;       // "12 Collins Street"
  streetName: string;    // "Collins Street"
  houseNumber: string;   // "12"
  lat?: number;
  lng?: number;
  status: DoorStatus;
  deliveredAt?: Date;
  deliveredBy?: string;
  deliveryCount?: number;
  history?: DeliveryEvent[];
  propertyId?: string;
};
