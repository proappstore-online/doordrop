import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../hooks/useAuthContext";
import { UserRepository } from "../../repositories/userRepository";
import { PlatformConfigRepository } from "../../repositories/platformConfigRepository";
import type { ClientProfile, AccountType } from "../../models/user";
import SuburbPostcodeAutocomplete from "../../components/SuburbPostcodeAutocomplete";


const ClientOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthContext();

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<"direct" | "platform">("direct");

  // Account type
  const [accountType, setAccountType] = useState<AccountType>("business");

  // Business info
  const [businessName, setBusinessName] = useState("");
  const [abn, setAbn] = useState("");
  const [acn, setAcn] = useState("");
  const [tradingName, setTradingName] = useState("");
  const [industry, setIndustry] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");

  // Contact
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactRole, setContactRole] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country] = useState("Australia");

  // Billing
  const [billingSameAsAddress, setBillingSameAsAddress] = useState(true);
  const [billingAddressLine1, setBillingAddressLine1] = useState("");
  const [billingAddressLine2, setBillingAddressLine2] = useState("");
  const [billingSuburb, setBillingSuburb] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingPostcode, setBillingPostcode] = useState("");
  const [billingEmail, setBillingEmail] = useState("");

  // Delivery preferences
  const [preferredAreas, setPreferredAreas] = useState("");
  const [typicalVolume, setTypicalVolume] = useState("");
  const [deliveryFrequency, setDeliveryFrequency] = useState("");
  const [materialType, setMaterialType] = useState("");

  // Additional
  const [howDidYouHear, setHowDidYouHear] = useState("");
  const [specialRequirements, setSpecialRequirements] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Load existing profile if any
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      try {
        try {
          const config = await PlatformConfigRepository.getConfig();
          setDefaultPaymentMode(config.defaultPaymentMode);
        } catch (err) {
          console.error("Failed to load platform config:", err);
        }
        const user = await UserRepository.getUser(currentUser.id);
        if (!user) return;
        const p = user.clientProfile;
        if (!p) {
          // Pre-fill contact from user data
          setContactFirstName(user.firstName || "");
          setContactLastName(user.lastName || "");
          setContactEmail(user.email || currentUser.login || "");
          setContactPhone(user.phoneNumber || "");
          return;
        }
        // Populate from existing profile
        setAccountType(p.accountType || "business");
        setBusinessName(p.businessName || "");
        setAbn(p.abn || "");
        setAcn(p.acn || "");
        setTradingName(p.tradingName || "");
        setIndustry(p.industry || "");
        setBusinessWebsite(p.businessWebsite || "");
        setContactFirstName(p.contactFirstName || "");
        setContactLastName(p.contactLastName || "");
        setContactEmail(p.contactEmail || "");
        setContactPhone(p.contactPhone || "");
        setContactRole(p.contactRole || "");
        setAddressLine1(p.addressLine1 || "");
        setAddressLine2(p.addressLine2 || "");
        setSuburb(p.suburb || "");
        setState(p.state || "");
        setPostcode(p.postcode || "");
        setBillingSameAsAddress(p.billingSameAsAddress ?? true);
        setBillingAddressLine1(p.billingAddressLine1 || "");
        setBillingAddressLine2(p.billingAddressLine2 || "");
        setBillingSuburb(p.billingSuburb || "");
        setBillingState(p.billingState || "");
        setBillingPostcode(p.billingPostcode || "");
        setBillingEmail(p.billingEmail || "");
        setPreferredAreas((p.preferredAreas || []).join(", "));
        setTypicalVolume(p.typicalVolume || "");
        setDeliveryFrequency(p.deliveryFrequency || "");
        setMaterialType(p.materialType || "");
        setHowDidYouHear(p.howDidYouHear || "");
        setSpecialRequirements(p.specialRequirements || "");
        setAgreedToTerms(p.agreedToTerms || false);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    // Validation
    if (!contactFirstName.trim() || !contactLastName.trim()) {
      setError("Contact first and last name are required.");
      return;
    }
    if (!contactEmail.trim()) {
      setError("Contact email is required.");
      return;
    }
    if (!contactPhone.trim()) {
      setError("Contact phone is required.");
      return;
    }
    const normalizedPhone = contactPhone.trim().replace(/\s+/g, "");
    if (!/^(\+?61|0)4\d{8}$/.test(normalizedPhone)) {
      setError("Please enter a valid Australian mobile number (e.g. 04XX XXX XXX).");
      return;
    }
    if (!addressLine1.trim() || !suburb.trim() || !state || !postcode.trim()) {
      setError("Full address is required.");
      return;
    }
    if (!/^\d{4}$/.test(postcode.trim())) {
      setError("Postcode must be a 4-digit number.");
      return;
    }
    if (accountType === "business" && !businessName.trim()) {
      setError("Business name is required for business accounts.");
      return;
    }
    if (abn && !/^\d{11}$/.test(abn.replace(/\s/g, ""))) {
      setError("ABN must be 11 digits.");
      return;
    }
    if (acn && !/^\d{9}$/.test(acn.replace(/\s/g, ""))) {
      setError("ACN must be 9 digits.");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the terms and conditions.");
      return;
    }

    setSaving(true);
    try {
      const profile: Record<string, any> = {
        accountType,
        onboardingCompleted: true,
        contactFirstName: contactFirstName.trim(),
        contactLastName: contactLastName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        addressLine1: addressLine1.trim(),
        suburb: suburb.trim(),
        state,
        postcode: postcode.trim(),
        country,
        billingSameAsAddress,
        agreedToTerms: true,
        agreedToTermsAt: new Date(),
      };
      if (contactRole.trim()) profile.contactRole = contactRole.trim();
      if (addressLine2.trim()) profile.addressLine2 = addressLine2.trim();

      // Business fields
      if (accountType === "business") {
        profile.businessName = businessName.trim();
        if (abn.trim()) profile.abn = abn.replace(/\s/g, "");
        if (acn.trim()) profile.acn = acn.replace(/\s/g, "");
        if (tradingName.trim()) profile.tradingName = tradingName.trim();
        if (industry.trim()) profile.industry = industry.trim();
        if (businessWebsite.trim()) profile.businessWebsite = businessWebsite.trim();
      }

      // Billing fields
      if (!billingSameAsAddress) {
        if (billingAddressLine1.trim()) profile.billingAddressLine1 = billingAddressLine1.trim();
        if (billingAddressLine2.trim()) profile.billingAddressLine2 = billingAddressLine2.trim();
        if (billingSuburb.trim()) profile.billingSuburb = billingSuburb.trim();
        if (billingState) profile.billingState = billingState;
        if (billingPostcode.trim()) profile.billingPostcode = billingPostcode.trim();
        if (billingEmail.trim()) profile.billingEmail = billingEmail.trim();
      }

      // Delivery preferences
      const areas = preferredAreas.split(",").map((s) => s.trim()).filter(Boolean);
      if (areas.length) profile.preferredAreas = areas;
      if (typicalVolume) profile.typicalVolume = typicalVolume;
      if (deliveryFrequency) profile.deliveryFrequency = deliveryFrequency;
      if (materialType) profile.materialType = materialType;

      // Additional
      if (howDidYouHear.trim()) profile.howDidYouHear = howDidYouHear.trim();
      if (specialRequirements.trim()) profile.specialRequirements = specialRequirements.trim();

      await UserRepository.updateUser(currentUser.id, {
        clientProfile: profile as ClientProfile,
        firstName: contactFirstName.trim(),
        lastName: contactLastName.trim(),
        phoneNumber: contactPhone.trim(),
        paymentMode: defaultPaymentMode,
      });

      navigate("/app");
    } catch (err) {
      console.error("Failed to save profile:", err);
      setError("Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center mt-8">
        <div className="inline-block w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const inputCls =
    "w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-500";
  const labelCls = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const sectionCls = "space-y-4";
  const headingCls = "text-lg font-semibold text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2";

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 pb-12">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
        Complete Your Profile
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Set up your account to start creating campaigns.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Account Type */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Account Type</h2>
          <div className="flex gap-4">
            {(["business", "individual"] as AccountType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setAccountType(type)}
                className={`flex-1 px-4 py-3 rounded-lg border-2 text-sm font-medium transition-colors ${
                  accountType === type
                    ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                }`}
              >
                {type === "business" ? "Business" : "Individual"}
              </button>
            ))}
          </div>
        </div>

        {/* Business Info */}
        {accountType === "business" && (
          <div className={sectionCls}>
            <h2 className={headingCls}>Business Information</h2>
            <div>
              <label className={labelCls}>Business Name <span className="text-red-500">*</span></label>
              <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>ABN</label>
                <input type="text" value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="11 digits" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>ACN</label>
                <input type="text" value={acn} onChange={(e) => setAcn(e.target.value)} placeholder="9 digits" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Trading Name</label>
              <input type="text" value={tradingName} onChange={(e) => setTradingName(e.target.value)} placeholder="If different from business name" className={inputCls} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Industry</label>
                <select value={industry} onChange={(e) => setIndustry(e.target.value)} className={inputCls}>
                  <option value="">Select...</option>
                  <option value="real_estate">Real Estate</option>
                  <option value="food_beverage">Food & Beverage</option>
                  <option value="retail">Retail</option>
                  <option value="health_fitness">Health & Fitness</option>
                  <option value="professional_services">Professional Services</option>
                  <option value="education">Education</option>
                  <option value="trades">Trades & Services</option>
                  <option value="automotive">Automotive</option>
                  <option value="nonprofit">Non-profit</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Business Website</label>
                <input type="url" value={businessWebsite} onChange={(e) => setBusinessWebsite(e.target.value)} placeholder="https://" className={inputCls} />
              </div>
            </div>
          </div>
        )}

        {/* Primary Contact */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Primary Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
              <input type="text" value={contactFirstName} onChange={(e) => setContactFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
              <input type="text" value={contactLastName} onChange={(e) => setContactLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Email <span className="text-red-500">*</span></label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="04XX XXX XXX" className={inputCls} />
            </div>
          </div>
          {accountType === "business" && (
            <div>
              <label className={labelCls}>Role / Title</label>
              <input type="text" value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="e.g. Marketing Manager, Owner" className={inputCls} />
            </div>
          )}
        </div>

        {/* Address */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Address</h2>
          <div>
            <label className={labelCls}>Address Line 1 <span className="text-red-500">*</span></label>
            <input type="text" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Address Line 2</label>
            <input type="text" value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} className={inputCls} />
          </div>
          <SuburbPostcodeAutocomplete
            suburb={suburb}
            postcode={postcode}
            state={state}
            onSuburbChange={setSuburb}
            onPostcodeChange={setPostcode}
            onStateChange={setState}
            disabled={saving}
            required
          />
          <div>
            <label className={labelCls}>Country</label>
            <input type="text" value={country} disabled className={`${inputCls} bg-gray-100 dark:bg-gray-700`} />
          </div>
        </div>

        {/* Billing */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Billing</h2>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={billingSameAsAddress}
              onChange={(e) => setBillingSameAsAddress(e.target.checked)}
              className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            Billing address same as above
          </label>
          {!billingSameAsAddress && (
            <>
              <div>
                <label className={labelCls}>Billing Address Line 1</label>
                <input type="text" value={billingAddressLine1} onChange={(e) => setBillingAddressLine1(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Billing Address Line 2</label>
                <input type="text" value={billingAddressLine2} onChange={(e) => setBillingAddressLine2(e.target.value)} className={inputCls} />
              </div>
              <SuburbPostcodeAutocomplete
                suburb={billingSuburb}
                postcode={billingPostcode}
                state={billingState}
                onSuburbChange={setBillingSuburb}
                onPostcodeChange={setBillingPostcode}
                onStateChange={setBillingState}
                disabled={saving}
              />
              <div>
                <label className={labelCls}>Billing Email</label>
                <input type="email" value={billingEmail} onChange={(e) => setBillingEmail(e.target.value)} placeholder="For invoices" className={inputCls} />
              </div>
            </>
          )}
        </div>

        {/* Delivery Preferences */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Delivery Preferences</h2>
          <div>
            <label className={labelCls}>Preferred Areas</label>
            <input
              type="text"
              value={preferredAreas}
              onChange={(e) => setPreferredAreas(e.target.value)}
              placeholder="Comma-separated suburbs, e.g. Bondi, Surry Hills"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Typical Volume</label>
              <select value={typicalVolume} onChange={(e) => setTypicalVolume(e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                <option value="under_500">Under 500</option>
                <option value="500_2000">500 - 2,000</option>
                <option value="2000_5000">2,000 - 5,000</option>
                <option value="5000_plus">5,000+</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Delivery Frequency</label>
              <select value={deliveryFrequency} onChange={(e) => setDeliveryFrequency(e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                <option value="one_off">One-off</option>
                <option value="weekly">Weekly</option>
                <option value="fortnightly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Material Type</label>
            <select value={materialType} onChange={(e) => setMaterialType(e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              <option value="flyers">Flyers</option>
              <option value="brochures">Brochures</option>
              <option value="menus">Menus</option>
              <option value="catalogues">Catalogues</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {/* Additional */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Additional Information</h2>
          <div>
            <label className={labelCls}>How did you hear about us?</label>
            <select value={howDidYouHear} onChange={(e) => setHowDidYouHear(e.target.value)} className={inputCls}>
              <option value="">Select...</option>
              <option value="google">Google Search</option>
              <option value="social_media">Social Media</option>
              <option value="referral">Referral</option>
              <option value="flyer">Received a Flyer</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Special Requirements</label>
            <textarea
              value={specialRequirements}
              onChange={(e) => setSpecialRequirements(e.target.value)}
              rows={3}
              placeholder="Any specific delivery instructions or requirements..."
              className={inputCls}
            />
          </div>
        </div>

        {/* Terms */}
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="text-emerald-600 hover:underline" target="_blank">
                Terms and Conditions
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-emerald-600 hover:underline" target="_blank">
                Privacy Policy
              </a>
              . <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={saving}
          className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition-colors"
        >
          {saving ? "Saving..." : "Complete Setup"}
        </button>
      </form>
    </div>
  );
};

export default ClientOnboardingPage;
