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
`;

async function runMigrations() {
  const p = getPool();
  if (!p) return;
  await p.query(MIGRATION_SQL);
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
