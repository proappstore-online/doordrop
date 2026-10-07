-- ShareHire bookings: a campaign admin books a walker for a day (issue #6).
-- Was the Firestore campaigns/{id}/bookings subcollection.
CREATE TABLE bookings (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  walker_id TEXT NOT NULL,
  walker_name TEXT,
  client_id TEXT NOT NULL,
  date INTEGER NOT NULL,
  door_count INTEGER NOT NULL,
  rate_per_door REAL NOT NULL,
  total_price REAL NOT NULL,
  price_per_member REAL NOT NULL,
  member_count INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_bookings_campaign_created ON bookings(campaign_id, created_at);
CREATE INDEX idx_bookings_walker ON bookings(walker_id);
