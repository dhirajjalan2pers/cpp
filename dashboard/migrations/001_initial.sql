CREATE TABLE IF NOT EXISTS cpp_session (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  cookie_encrypted BYTEA NOT NULL,
  cookie_count INTEGER NOT NULL,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cpp_jobs (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  contract_type TEXT NOT NULL DEFAULT '',
  application_method TEXT NOT NULL DEFAULT '',
  is_paid BOOLEAN,
  url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  applicant_count INTEGER NOT NULL DEFAULT 0,
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manual_jobs (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  company_name TEXT NOT NULL,
  industry TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  contract_type TEXT NOT NULL DEFAULT '',
  application_method TEXT NOT NULL DEFAULT '',
  is_paid BOOLEAN,
  url TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  deadline TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS job_state (
  job_source TEXT NOT NULL CHECK (job_source IN ('cpp', 'manual')),
  job_id TEXT NOT NULL,
  starred BOOLEAN NOT NULL DEFAULT FALSE,
  archived BOOLEAN NOT NULL DEFAULT FALSE,
  applied BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_source, job_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('resume', 'cover_letter')),
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK (mime_type = 'application/pdf'),
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  content_encrypted BYTEA NOT NULL,
  content_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS documents_one_resume ON documents(kind) WHERE kind = 'resume';

CREATE TABLE IF NOT EXISTS fit_scores (
  job_source TEXT NOT NULL CHECK (job_source IN ('cpp', 'manual')),
  job_id TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  analysis JSONB NOT NULL,
  resume_hash TEXT NOT NULL,
  job_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (job_source, job_id)
);

CREATE TABLE IF NOT EXISTS whatsapp_chats (
  jid TEXT PRIMARY KEY,
  name TEXT,
  last_message_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  jid TEXT PRIMARY KEY,
  phone_number TEXT,
  name TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  sqlite_rowid BIGINT NOT NULL,
  message_id TEXT NOT NULL,
  chat_jid TEXT NOT NULL,
  sender TEXT,
  content TEXT NOT NULL DEFAULT '',
  is_from_me BOOLEAN NOT NULL DEFAULT FALSE,
  media_type TEXT,
  sent_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (chat_jid, message_id)
);
CREATE INDEX IF NOT EXISTS whatsapp_messages_time ON whatsapp_messages(sent_at DESC);

CREATE TABLE IF NOT EXISTS whatsapp_sync_state (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  last_rowid BIGINT NOT NULL DEFAULT 0,
  last_synced_at TIMESTAMPTZ,
  last_error TEXT
);

