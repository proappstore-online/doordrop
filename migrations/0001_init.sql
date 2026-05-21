-- DoorDrop initial schema.
--
-- D1 = SQLite. JSON columns are TEXT — read with json_extract / json_each.
-- Dates are INTEGER epoch milliseconds across the wire (no Timestamp type).
-- ID strings are TEXT (UUIDs minted client-side or derived deterministically
-- for properties — see propertyDocId in the original codebase).
--
-- Applied via the platform Data Worker's POST /migrate endpoint, which splits
-- on `;` and runs each statement. No semicolons inside string literals here.

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  photo_url TEXT,
  role TEXT CHECK (role IN ('client','walker','admin')),
  payment_mode TEXT CHECK (payment_mode IN ('direct','platform')),
  client_profile TEXT,
  walker_profile TEXT,
  campaign_id TEXT,
  street TEXT,
  suburb TEXT,
  postcode TEXT,
  state TEXT,
  country TEXT,
  location TEXT,
  phone_number TEXT,
  bio TEXT,
  website TEXT,
  linkedin TEXT,
  door_count TEXT,
  delivery_photos TEXT,
  profile_completed INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  last_logged_in_at INTEGER
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_campaign ON users(campaign_id);
CREATE INDEX idx_users_suburb_postcode ON users(suburb, postcode);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_key TEXT,
  street_name TEXT,
  suburb TEXT,
  postcode TEXT,
  state TEXT,
  country TEXT,
  plan_type TEXT CHECK (plan_type IN ('roster','pooling')),
  status TEXT NOT NULL CHECK (status IN ('draft','ready','assigned','complete','review','payment','archive')),
  admin_ids TEXT NOT NULL,
  member_ids TEXT,
  assigned_walker_id TEXT,
  schedule_rule TEXT,
  user_payment TEXT,
  total_doors INTEGER,
  budget INTEGER,
  due_date INTEGER,
  completed_at INTEGER,
  archived_at INTEGER,
  lat REAL,
  lng REAL,
  door_radius_m INTEGER,
  junk_mail_policy TEXT CHECK (junk_mail_policy IN ('deliver','skip')),
  property_filter TEXT CHECK (property_filter IN ('all','residential','commercial')),
  business_categories TEXT,
  active_printout_id TEXT,
  job_status TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_campaigns_assigned_walker ON campaigns(assigned_walker_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_suburb_postcode ON campaigns(suburb, postcode);

CREATE TABLE properties (
  id TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  street_name TEXT,
  house_number TEXT,
  suburb TEXT,
  postcode TEXT,
  state TEXT,
  lat REAL,
  lng REAL,
  commercial INTEGER,
  access_user_ids TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_properties_suburb_postcode ON properties(suburb, postcode);

CREATE TABLE property_reports (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('no_house','construction','angry_owner','no_junk_mail','other')),
  photo_url TEXT,
  notes TEXT,
  reported_at INTEGER NOT NULL,
  reported_by TEXT NOT NULL,
  campaign_id TEXT
);

CREATE INDEX idx_property_reports_property ON property_reports(property_id);
CREATE INDEX idx_property_reports_reported_by ON property_reports(reported_by);

CREATE TABLE doors (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  street_name TEXT,
  house_number TEXT,
  lat REAL,
  lng REAL,
  status TEXT NOT NULL CHECK (status IN ('pending','delivered','reported')),
  delivered_at INTEGER,
  delivered_by TEXT,
  delivery_count INTEGER,
  history TEXT,
  property_id TEXT REFERENCES properties(id)
);

CREATE INDEX idx_doors_campaign ON doors(campaign_id);
CREATE INDEX idx_doors_property ON doors(property_id);

CREATE TABLE flyers (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX idx_flyers_owner ON flyers(owner_id);

CREATE TABLE printouts (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  flyer_id TEXT REFERENCES flyers(id),
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

CREATE INDEX idx_printouts_campaign ON printouts(campaign_id);

CREATE TABLE delivery_runs (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  walker_id TEXT,
  status TEXT CHECK (status IN ('scheduled','completed')),
  date INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_delivery_runs_campaign ON delivery_runs(campaign_id);
CREATE INDEX idx_delivery_runs_walker ON delivery_runs(walker_id);
CREATE INDEX idx_delivery_runs_date ON delivery_runs(date);

CREATE TABLE track_sessions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  walker_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER
);

CREATE INDEX idx_track_sessions_campaign ON track_sessions(campaign_id);
CREATE INDEX idx_track_sessions_walker ON track_sessions(walker_id);

CREATE TABLE track_points (
  session_id TEXT NOT NULL REFERENCES track_sessions(id) ON DELETE CASCADE,
  t INTEGER NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  speed REAL,
  PRIMARY KEY (session_id, t)
);

CREATE TABLE track_stops (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES track_sessions(id) ON DELETE CASCADE,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL
);

CREATE INDEX idx_track_stops_session ON track_stops(session_id);

CREATE TABLE walker_interests (
  id TEXT PRIMARY KEY,
  walker_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER,
  UNIQUE (walker_id, campaign_id)
);

CREATE INDEX idx_walker_interests_walker ON walker_interests(walker_id);
CREATE INDEX idx_walker_interests_campaign ON walker_interests(campaign_id);

CREATE TABLE walker_reviews (
  id TEXT PRIMARY KEY,
  walker_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_name TEXT,
  campaign_id TEXT,
  schedule_id TEXT,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER
);

CREATE INDEX idx_walker_reviews_walker ON walker_reviews(walker_id);
CREATE INDEX idx_walker_reviews_reviewer ON walker_reviews(reviewer_id);

CREATE TABLE history_records (
  id TEXT PRIMARY KEY,
  walker_id TEXT NOT NULL,
  date INTEGER NOT NULL,
  street_name TEXT,
  income INTEGER,
  door_count INTEGER,
  duration_min INTEGER
);

CREATE INDEX idx_history_records_walker ON history_records(walker_id);
CREATE INDEX idx_history_records_date ON history_records(date);

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('walker_interested','walker_assigned')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  campaign_id TEXT,
  read INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read);
CREATE INDEX idx_notifications_user_created ON notifications(user_id, created_at);

CREATE TABLE campaign_notes (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_campaign_notes_campaign_created ON campaign_notes(campaign_id, created_at);

CREATE TABLE chat_read_state (
  user_id TEXT NOT NULL,
  campaign_id TEXT NOT NULL,
  last_read_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, campaign_id)
);

CREATE TABLE platform_config (
  id TEXT PRIMARY KEY DEFAULT 'platform',
  default_payment_mode TEXT NOT NULL CHECK (default_payment_mode IN ('direct','platform'))
);

INSERT INTO platform_config (id, default_payment_mode) VALUES ('platform', 'platform')
