/**
 * PostgreSQL pool and schema bootstrap. Set DATABASE_URL to enable (e.g. Railway Postgres).
 */

const { Pool } = require('pg');

let pool = null;

function shouldUseSsl(connectionString) {
  if (!connectionString) return false;
  if (/localhost|127\.0\.0\.1/.test(connectionString)) return false;
  return true;
}

function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (pool) return pool;
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 10,
    ssl: shouldUseSsl(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false
  });
  return pool;
}

function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim());
}

const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS portfolio_items (
  collection TEXT NOT NULL CHECK (collection IN ('experiences', 'projects')),
  id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL,
  PRIMARY KEY (collection, id)
);

CREATE TABLE IF NOT EXISTS app_kv (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS hero_video_blob (
  id SMALLINT PRIMARY KEY CHECK (id IN (1, 2)),
  data BYTEA NOT NULL,
  mime_type TEXT NOT NULL,
  original_filename TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

async function migrateHeroVideoBlobIds(p) {
  await p.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'hero_video_blob_id_check'
          AND conrelid = 'hero_video_blob'::regclass
      ) THEN
        ALTER TABLE hero_video_blob DROP CONSTRAINT hero_video_blob_id_check;
        ALTER TABLE hero_video_blob ADD CONSTRAINT hero_video_blob_id_check CHECK (id IN (1, 2));
      END IF;
    EXCEPTION
      WHEN undefined_table THEN NULL;
    END $$;
  `);
}

async function runMigrations() {
  const p = getPool();
  if (!p) return;
  await p.query(MIGRATION_SQL);
  await migrateHeroVideoBlobIds(p);
}

async function initDb() {
  await runMigrations();
}

module.exports = {
  getPool,
  isDatabaseEnabled,
  runMigrations,
  initDb
};
