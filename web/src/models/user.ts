export type UserData = {
  name: string;
  email: string;
  resume?: string;
  createdAt: Date;
  updatedAt?: Date;
  tokenExpiry?: number;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  address?: string;
  addressNumber?: string;
  photoURL?: string;
  street?: string;
  suburb?: string;
  postcode?: string;
  location?: string;
  country?: string;
  bio?: string;
  website?: string;
  linkedin?: string;
  campaignId?: string;
  profileCompleted?: boolean;
  doorCount?: string;
  deliveryPhotos?: string[];

  role: "client" | "walker" | "admin";
  paymentMode?: "direct" | "platform";

  clientProfile?: ClientProfile;

  walkerProfile?: {
    // Personal info
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    dateOfBirth?: string;
    bio?: string;
    profilePhotoUrl?: string;

    // Address
    addressLine1?: string;
    addressLine2?: string;
    suburb?: string;
    postcode?: string;
    state?: string;
    country?: string;

    // Work preferences
    serviceRadiusKm: number;
    ratePerDoor?: number;
    availableDays?: string[];
    preferredTimeSlot?: string;
    hasVehicle?: boolean;
    vehicleType?: string;
    maxDoorsPerDay?: number;

    // Verification
    hasABN?: boolean;
    abn?: string;
    hasPoliceCheck?: boolean;
    policeCheckDate?: string;
    hasWWCC?: boolean;
    wwccNumber?: string;
    previousExperience?: string;

    // Emergency contact
    emergencyContactName?: string;
    emergencyContactPhone?: string;
    emergencyContactRelation?: string;

    // Aggregated stats
    totalCampaignsCompleted?: number;
    totalDoorsDelivered?: number;
    totalKmWalked?: number;
    totalMinutesSpent?: number;

    // Onboarding
    onboardingCompleted?: boolean;

    // Legacy
    addressNumber?: string;
    homeStreetName?: string;
    billingAddress?: { bAddress?: string };
  };
};

export type AccountType = "business" | "individual";

export type ClientProfile = {
  // Account type
  accountType: AccountType;
  onboardingCompleted: boolean;

  // Business info (required for business, optional for individual)
  businessName?: string;
  abn?: string;          // Australian Business Number (11 digits)
  acn?: string;          // Australian Company Number (9 digits)
  tradingName?: string;  // If different from business name
  industry?: string;
  businessWebsite?: string;

  // Primary contact
  contactFirstName: string;
  contactLastName: string;
  contactEmail: string;
  contactPhone: string;
  contactRole?: string;  // e.g. "Marketing Manager", "Owner"

  // Business address
  addressLine1: string;
  addressLine2?: string;
  suburb: string;
  state: string;
  postcode: string;
  country: string;

  // Billing (if different from business address)
  billingSameAsAddress: boolean;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingSuburb?: string;
  billingState?: string;
  billingPostcode?: string;
  billingEmail?: string;  // For invoices

  // Delivery preferences
  preferredAreas?: string[];    // Suburbs they typically deliver to
  typicalVolume?: string;       // "under_500" | "500_2000" | "2000_5000" | "5000_plus"
  deliveryFrequency?: string;   // "one_off" | "weekly" | "fortnightly" | "monthly" | "quarterly"
  materialType?: string;        // "flyers" | "brochures" | "menus" | "catalogues" | "other"

  // Additional
  howDidYouHear?: string;
  specialRequirements?: string;
  agreedToTerms: boolean;
  agreedToTermsAt?: Date;
};

export type UserWithId = UserData & { id: string };
