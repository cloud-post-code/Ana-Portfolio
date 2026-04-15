/**
 * CMS data access: PostgreSQL when DATABASE_URL is set, else JSON files under data/.
 */

const fs = require('fs');
const path = require('path');
const { getPool, isDatabaseEnabled } = require('./db');

const DATA_DIR = path.join(__dirname, '..', 'data');

function dataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function readJsonFile(filename) {
  return JSON.parse(fs.readFileSync(dataPath(filename), 'utf8'));
}

function writeJsonFile(filename, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2));
}

// ─── Jobs CRM ───────────────────────────────────────────────────────────────

async function getJobsCrm() {
  if (isDatabaseEnabled()) {
    const pool = getPool();
    const r = await pool.query(
      'SELECT data FROM jobs_crm ORDER BY sort_order ASC, id ASC'
    );
    return r.rows.map(function (row) {
      return row.data;
    });
  }
  try {
    const raw = readJsonFile('jobs-crm.json');
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

async function saveJobsCrm(jobs) {
  if (!Array.isArray(jobs)) throw new Error('saveJobsCrm expects an array');
  if (isDatabaseEnabled()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM jobs_crm');
      for (let i = 0; i < jobs.length; i++) {
        const row = jobs[i];
        if (!row || !row.id) continue;
        await client.query(
          'INSERT INTO jobs_crm (id, sort_order, data) VALUES ($1, $2, $3::jsonb)',
          [String(row.id), i, row]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  writeJsonFile('jobs-crm.json', jobs);
}

// ─── Portfolio (experiences / projects) ───────────────────────────────────

async function getPortfolio(collection) {
  if (collection !== 'experiences' && collection !== 'projects') {
    throw new Error('Invalid collection');
  }
  if (isDatabaseEnabled()) {
    const pool = getPool();
    const r = await pool.query(
      'SELECT data FROM portfolio_items WHERE collection = $1 ORDER BY sort_order ASC, id ASC',
      [collection]
    );
    return r.rows.map(function (row) {
      return row.data;
    });
  }
  const file = collection === 'experiences' ? 'experiences.json' : 'projects.json';
  return readJsonFile(file);
}

async function savePortfolio(collection, items) {
  if (collection !== 'experiences' && collection !== 'projects') {
    throw new Error('Invalid collection');
  }
  if (!Array.isArray(items)) throw new Error('savePortfolio expects an array');
  if (isDatabaseEnabled()) {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM portfolio_items WHERE collection = $1', [collection]);
      for (let i = 0; i < items.length; i++) {
        const row = items[i];
        if (!row || !row.id) continue;
        await client.query(
          'INSERT INTO portfolio_items (collection, id, sort_order, data) VALUES ($1, $2, $3, $4::jsonb)',
          [collection, String(row.id), i, row]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return;
  }
  const file = collection === 'experiences' ? 'experiences.json' : 'projects.json';
  writeJsonFile(file, items);
}

// ─── Key-value (resume meta, resume markdown body, job search profile) ───────

async function getKv(key) {
  if (isDatabaseEnabled()) {
    const pool = getPool();
    const r = await pool.query('SELECT value FROM app_kv WHERE key = $1', [key]);
    if (!r.rows.length) return null;
    return r.rows[0].value;
  }
  const fileMap = {
    resume: 'resume.json',
    job_search_profile: 'job-search-profile.json'
  };
  const fn = fileMap[key];
  if (!fn) return null;
  try {
    return readJsonFile(fn);
  } catch (e) {
    return null;
  }
}

async function setKv(key, value) {
  if (isDatabaseEnabled()) {
    const pool = getPool();
    await pool.query(
      'INSERT INTO app_kv (key, value) VALUES ($1, $2::jsonb) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
      [key, value]
    );
    return;
  }
  const fileMap = {
    resume: 'resume.json',
    job_search_profile: 'job-search-profile.json'
  };
  const fn = fileMap[key];
  if (!fn) throw new Error('Unknown kv key: ' + key);
  writeJsonFile(fn, value);
}

/** Remove a row from app_kv (PostgreSQL only). Used for resume_markdown cleanup; file-backed keys use unlink in callers when needed. */
async function deleteKv(key) {
  if (isDatabaseEnabled()) {
    await getPool().query('DELETE FROM app_kv WHERE key = $1', [key]);
  }
}

async function getCollection(key) {
  if (key === 'jobs-crm') return getJobsCrm();
  if (key === 'experiences') return getPortfolio('experiences');
  if (key === 'projects') return getPortfolio('projects');
  throw new Error('Unknown collection: ' + key);
}

async function saveCollection(key, items) {
  if (key === 'jobs-crm') return saveJobsCrm(items);
  if (key === 'experiences') return savePortfolio('experiences', items);
  if (key === 'projects') return savePortfolio('projects', items);
  throw new Error('Unknown collection: ' + key);
}

module.exports = {
  getJobsCrm,
  saveJobsCrm,
  getPortfolio,
  savePortfolio,
  getKv,
  setKv,
  deleteKv,
  getCollection,
  saveCollection,
  isDatabaseEnabled
};
