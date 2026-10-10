-- Add campaign_id to history_records to link delivery history back to campaign status
-- This enables showing campaign status (review, payment, dispute) in walker history

ALTER TABLE history_records ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);

CREATE INDEX IF NOT EXISTS idx_history_records_campaign ON history_records(campaign_id);
