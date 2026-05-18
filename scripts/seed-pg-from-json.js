#!/usr/bin/env node
/**
 * Bootstrap PostgreSQL from committed JSON when (and only when) a collection
 * or key is empty. The live admin UI is the source of truth for production
 * content; this script only fills in blanks on a fresh database so the site
 * is not empty after a cold start.
 *
 * Default behaviour (preserves admin edits across deploys):
 *   - portfolio_items: skip a collection if any rows already exist.
 *   - app_kv:          skip a key if a row already exists.
 *   - public/resume.md: imported only if resume_markdown KV row is absent.
 *
 * Run: npm run db:seed
 *
 * Env flags:
 *   SKIP_DB_SEED=1  → no-op (used to bypass entirely).
 *   SEED_FORCE=1    → restore the original destructive behaviour: overwrite
 *                     every collection and KV key from the JSON files. Use
 *                     only for deliberate resets, never in routine deploys.
 *
 * Without DATABASE_URL the script exits 0 (app falls back to data/*.json).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dataDir = path.join(ROOT, 'data');

/** @type { { file: string, key: string }[] } */
const KV_FILES = [
  { file: 'hero_video.json', key: 'hero_video' },
  { file: 'job-search-profile.json', key: 'job_search_profile' },
  { file: 'resume-notes.json', key: 'resume_notes' },
  { file: 'resume-profile-notes.json', key: 'resume_profile_notes' }
];

function read(name) {
  const p = path.join(dataDir, name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function main() {
  if (process.env.SKIP_DB_SEED === '1') {
    console.log('[seed] Skipping (SKIP_DB_SEED=1).');
    process.exit(0);
  }

  const dbUrl = process.env.DATABASE_URL && String(process.env.DATABASE_URL).trim();
  if (!dbUrl) {
    console.log(
      '[seed] No DATABASE_URL — skipping PostgreSQL import. The app will use data/*.json on disk when Postgres is not enabled.'
    );
    process.exit(0);
  }

  await require('../lib/db').initDb();
  const cms = require('../lib/cms-store');

  const force = process.env.SEED_FORCE === '1';
  if (force) {
    console.log('[seed] SEED_FORCE=1 → overwriting every collection and KV key from JSON. Admin edits in Postgres will be lost.');
  }

  async function seedCollection(name, file) {
    const items = read(file);
    if (!Array.isArray(items) || !items.length) {
      console.log('[seed] No', file, 'or empty array — skipping', name + '.');
      return;
    }
    const existing = await cms.countPortfolio(name);
    if (existing > 0 && !force) {
      console.log('[seed]', name, 'already populated (' + existing + ' rows) — preserving DB.');
      return;
    }
    await cms.savePortfolio(name, items);
    console.log('[seed] Imported', name + ':', items.length, force ? '(forced overwrite)' : '(fresh bootstrap)');
  }

  await seedCollection('experiences', 'experiences.json');
  await seedCollection('projects', 'projects.json');

  async function seedKv(key, value, label) {
    if (value == null) return;
    if (await cms.hasKv(key)) {
      if (!force) {
        console.log('[seed]', key, 'already present in app_kv — preserving DB.');
        return;
      }
      console.log('[seed] Overwriting', key, '(SEED_FORCE=1)');
    }
    await cms.setKv(key, value);
    console.log('[seed] Imported', label || key);
  }

  const resume = read('resume.json');
  if (resume && typeof resume === 'object') {
    await seedKv('resume', resume, 'data/resume.json → resume');
  }

  for (const { file, key } of KV_FILES) {
    const data = read(file);
    if (data == null) continue;
    if (typeof data !== 'object' || Array.isArray(data)) {
      console.warn('[seed] Skip', file, '(expected a JSON object).');
      continue;
    }
    await seedKv(key, data, 'data/' + file + ' → ' + key);
  }

  const resumeMdPath = path.join(ROOT, 'public', 'resume.md');
  if (fs.existsSync(resumeMdPath)) {
    const content = fs.readFileSync(resumeMdPath, 'utf8');
    await seedKv('resume_markdown', { content }, 'public/resume.md → resume_markdown');
  }

  console.log('[seed] Done.');
  process.exit(0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
