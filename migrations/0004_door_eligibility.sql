-- Add delivery-policy eligibility metadata to doors table
-- Tracks property type, junk mail eligibility, and confidence level
-- Used to enforce campaign property_filter and junk_mail_policy during delivery

ALTER TABLE doors ADD COLUMN property_type TEXT CHECK (property_type IN ('residential','commercial'));
ALTER TABLE doors ADD COLUMN junk_mail_eligible INTEGER;
ALTER TABLE doors ADD COLUMN eligibility_confidence TEXT CHECK (eligibility_confidence IN ('certain','uncertain','unknown'));
