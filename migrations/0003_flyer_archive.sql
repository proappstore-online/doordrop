-- Issue #51: Add archival support for library flyers to prevent silent mutation of campaign history.
-- Archived flyers are hidden from new campaign selections but existing campaigns remain unaffected.
ALTER TABLE flyers ADD COLUMN archived_at INTEGER;
