import React, { useState, useEffect } from "react";
import { useAuthContext } from "../../hooks/useAuthContext";
import { UserRepository } from "../../repositories/userRepository";
import { PlatformConfigRepository } from "../../repositories/platformConfigRepository";
import { useNavigate } from "react-router-dom";
import { AU_STATE_CITY_MAP } from "../../data/countryData";

const AU_STATES = [...new Set(AU_STATE_CITY_MAP.map((item) => item.state))];

const DAYS_OF_WEEK = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

const WalkerSetupPage: React.FC = () => {
  const { currentUser } = useAuthContext();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Personal info
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bio, setBio] = useState("");

  // Address
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [suburb, setSuburb] = useState("");
  const [postcode, setPostcode] = useState("");
  const [state, setState] = useState("");
  const [country] = useState("Australia");

  // Work preferences
  const [serviceRadiusKm, setServiceRadiusKm] = useState(5);
  const [ratePerDoor, setRatePerDoor] = useState(0);
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [preferredTimeSlot, setPreferredTimeSlot] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [maxDoorsPerDay, setMaxDoorsPerDay] = useState(0);

  // Verification
  const [hasABN, setHasABN] = useState(false);
  const [abn, setAbn] = useState("");
  const [hasPoliceCheck, setHasPoliceCheck] = useState(false);
  const [policeCheckDate, setPoliceCheckDate] = useState("");
  const [hasWWCC, setHasWWCC] = useState(false);
  const [wwccNumber, setWwccNumber] = useState("");
  const [previousExperience, setPreviousExperience] = useState("");

  // Emergency contact
  const [emergencyContactName, setEmergencyContactName] = useState("");
  const [emergencyContactPhone, setEmergencyContactPhone] = useState("");
  const [emergencyContactRelation, setEmergencyContactRelation] = useState("");

  // Terms
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // Payment
  const [defaultPaymentMode, setDefaultPaymentMode] = useState<"direct" | "platform">("direct");

  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      try {
        PlatformConfigRepository.getConfig()
        try {
          const config = await PlatformConfigRepository.getConfig();
          setDefaultPaymentMode(config.defaultPaymentMode);
        } catch (err) {
          console.error("Failed to load platform config:", err);
        }
        const user = await UserRepository.getUser(currentUser.id);
        if (!user) return;
        const p = user.walkerProfile;
        // Pre-fill from user data
        setFirstName(p?.firstName || user.firstName || "");
        setLastName(p?.lastName || user.lastName || "");
        setPhone(p?.phone || user.phoneNumber || "");
        setEmail(p?.email || user.email || currentUser.login || "");
        setBio(p?.bio || user.bio || "");

        if (p) {
          setDateOfBirth(p.dateOfBirth || "");
          setAddressLine1(p.addressLine1 || "");
          setAddressLine2(p.addressLine2 || "");
          setSuburb(p.suburb || "");
          setPostcode(p.postcode || "");
          setState(p.state || "");
          setServiceRadiusKm(p.serviceRadiusKm || 5);
          setRatePerDoor(p.ratePerDoor || 0);
          setAvailableDays(p.availableDays || []);
          setPreferredTimeSlot(p.preferredTimeSlot || "");
          setVehicleType(p.vehicleType || "");
          setMaxDoorsPerDay(p.maxDoorsPerDay || 0);
          setHasABN(p.hasABN || false);
          setAbn(p.abn || "");
          setHasPoliceCheck(p.hasPoliceCheck || false);
          setPoliceCheckDate(p.policeCheckDate || "");
          setHasWWCC(p.hasWWCC || false);
          setWwccNumber(p.wwccNumber || "");
          setPreviousExperience(p.previousExperience || "");
          setEmergencyContactName(p.emergencyContactName || "");
          setEmergencyContactPhone(p.emergencyContactPhone || "");
          setEmergencyContactRelation(p.emergencyContactRelation || "");
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [currentUser]);

  const toggleDay = (day: string) => {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setError(null);

    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required.");
      return;
    }
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    const normalizedPhone = phone.trim().replace(/\s+/g, "");
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
    if (!serviceRadiusKm || serviceRadiusKm <= 0) {
      setError("Service radius is required.");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the terms and conditions.");
      return;
    }

    setSaving(true);
    try {
      const profile: Record<string, any> = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        email: email.trim(),
        bio: bio.trim() || undefined,
        dateOfBirth: dateOfBirth || undefined,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        suburb: suburb.trim(),
        postcode: postcode.trim(),
        state,
        country,
        serviceRadiusKm: Number(serviceRadiusKm),
        ratePerDoor: Number(ratePerDoor) || undefined,
        availableDays: availableDays.length > 0 ? availableDays : undefined,
        preferredTimeSlot: preferredTimeSlot || undefined,
        vehicleType: vehicleType || undefined,
        maxDoorsPerDay: Number(maxDoorsPerDay) || undefined,
        hasABN,
        abn: hasABN && abn.trim() ? abn.trim() : undefined,
        hasPoliceCheck,
        policeCheckDate: hasPoliceCheck && policeCheckDate ? policeCheckDate : undefined,
        hasWWCC,
        wwccNumber: hasWWCC && wwccNumber.trim() ? wwccNumber.trim() : undefined,
        previousExperience: previousExperience.trim() || undefined,
        emergencyContactName: emergencyContactName.trim() || undefined,
        emergencyContactPhone: emergencyContactPhone.trim() || undefined,
        emergencyContactRelation: emergencyContactRelation.trim() || undefined,
        onboardingCompleted: true,
      };

      // Strip undefined values — Firestore rejects them
      const cleanProfile = Object.fromEntries(
        Object.entries(profile).filter(([, v]) => v !== undefined)
      );

      await UserRepository.updateUser(currentUser.id, {
        walkerProfile: cleanProfile as any,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phone.trim(),
        updatedAt: new Date(),
        paymentMode: defaultPaymentMode,
      });
      navigate("/walker");
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
        Set Up Your Walker Profile
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Complete your profile to start accepting delivery campaigns.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Personal Info */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Personal Information</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>First Name <span className="text-red-500">*</span></label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Last Name <span className="text-red-500">*</span></label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone <span className="text-red-500">*</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="04XX XXX XXX" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell clients a bit about yourself..."
              className={inputCls}
            />
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Suburb <span className="text-red-500">*</span></label>
              <input type="text" value={suburb} onChange={(e) => setSuburb(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>State <span className="text-red-500">*</span></label>
              <select value={state} onChange={(e) => setState(e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                {AU_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Postcode <span className="text-red-500">*</span></label>
              <input type="text" value={postcode} onChange={(e) => setPostcode(e.target.value)} maxLength={4} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input type="text" value={country} disabled className={`${inputCls} bg-gray-100 dark:bg-gray-700`} />
          </div>
        </div>

        {/* Work Preferences */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Work Preferences</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Service Radius (km) <span className="text-red-500">*</span></label>
              <input type="number" min="1" value={serviceRadiusKm} onChange={(e) => setServiceRadiusKm(Number(e.target.value))} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Rate per Door ($)</label>
              <input type="number" min="0" step="0.01" value={ratePerDoor} onChange={(e) => setRatePerDoor(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Available Days</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    availableDays.includes(day)
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300"
                      : "border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {day.charAt(0).toUpperCase() + day.slice(1, 3)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Preferred Time</label>
              <select value={preferredTimeSlot} onChange={(e) => setPreferredTimeSlot(e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="flexible">Flexible</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Transport</label>
              <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} className={inputCls}>
                <option value="">Select...</option>
                <option value="on_foot">On Foot</option>
                <option value="bicycle">Bicycle</option>
                <option value="scooter">Scooter</option>
                <option value="car">Car</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Max Doors per Day</label>
              <input type="number" min="0" value={maxDoorsPerDay} onChange={(e) => setMaxDoorsPerDay(Number(e.target.value))} className={inputCls} />
            </div>
          </div>
        </div>

        {/* Verification */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Verification</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={hasABN} onChange={(e) => setHasABN(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              I have an ABN
            </label>
            {hasABN && (
              <div>
                <label className={labelCls}>ABN</label>
                <input type="text" value={abn} onChange={(e) => setAbn(e.target.value)} placeholder="11 digits" className={inputCls} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={hasPoliceCheck} onChange={(e) => setHasPoliceCheck(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              I have a Police Check
            </label>
            {hasPoliceCheck && (
              <div>
                <label className={labelCls}>Police Check Date</label>
                <input type="date" value={policeCheckDate} onChange={(e) => setPoliceCheckDate(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input type="checkbox" checked={hasWWCC} onChange={(e) => setHasWWCC(e.target.checked)} className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
              I have a Working With Children Check (WWCC)
            </label>
            {hasWWCC && (
              <div>
                <label className={labelCls}>WWCC Number</label>
                <input type="text" value={wwccNumber} onChange={(e) => setWwccNumber(e.target.value)} className={inputCls} />
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Previous Experience</label>
            <textarea
              value={previousExperience}
              onChange={(e) => setPreviousExperience(e.target.value)}
              rows={3}
              placeholder="Describe any relevant delivery or letterbox drop experience..."
              className={inputCls}
            />
          </div>
        </div>

        {/* Emergency Contact */}
        <div className={sectionCls}>
          <h2 className={headingCls}>Emergency Contact</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Name</label>
              <input type="text" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input type="tel" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Relationship</label>
            <input type="text" value={emergencyContactRelation} onChange={(e) => setEmergencyContactRelation(e.target.value)} placeholder="e.g. Partner, Parent, Friend" className={inputCls} />
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

export default WalkerSetupPage;
