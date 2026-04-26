'use strict';

require('dotenv').config();
const { query, close } = require('../src/config/database');
const logger = require('../src/utils/logger');

const UP = `
-- ── Extensions ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enums ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('email', 'webhook');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_status AS ENUM ('pending', 'queued', 'delivered', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id             UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  type           notification_type     NOT NULL,
  status         notification_status   NOT NULL DEFAULT 'pending',
  recipient      TEXT                  NOT NULL,
  subject        TEXT                  NOT NULL,
  body           TEXT                  NOT NULL,
  metadata       JSONB                 NOT NULL DEFAULT '{}',
  retry_count    INTEGER               NOT NULL DEFAULT 0,
  error_message  TEXT,
  delivered_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status  ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type    ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- ── api_keys ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT        NOT NULL,
  prefix       CHAR(8)     NOT NULL UNIQUE,
  key_hash     TEXT        NOT NULL,
  scopes       JSONB       NOT NULL DEFAULT '[]',
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix    ON api_keys(prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

-- ── updated_at trigger ───────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`;

const DOWN = `
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS api_keys CASCADE;
DROP TYPE IF EXISTS notification_type CASCADE;
DROP TYPE IF EXISTS notification_status CASCADE;
DROP FUNCTION IF EXISTS set_updated_at CASCADE;
`;

async function migrate(direction = 'up') {
  try {
    logger.info({ direction }, 'Running migration...');
    await query(direction === 'up' ? UP : DOWN);
    logger.info({ direction }, 'Migration complete');
  } catch (err) {
    logger.error({ err }, 'Migration failed');
    process.exit(1);
  } finally {
    await close();
  }
}

const direction = process.argv[2] === 'rollback' ? 'down' : 'up';
migrate(direction);
