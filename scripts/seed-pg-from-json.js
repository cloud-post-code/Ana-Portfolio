#!/usr/bin/env node
/**
 * Import committed JSON from data/ (and public/resume.md) into PostgreSQL.
 * Used on Railway (pre-deploy) so portfolio + resume metadata match the repo.
 * Image binary assets (e.g. /assets, /logos) come from the container; paths in JSON must match.
 *
 * Run: npm run db:seed
 * Optional: SKIP_DB_SEED=1 to no-op; without DATABASE_URL, exits 0 and skips.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dataDir = path.join(ROOT, 'data');

/** @type { { file: string, key: string }[] } */
const KV_FILES = [
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

  const ex = read('experiences.json');
  if (Array.isArray(ex) && ex.length) {
    await cms.savePortfolio('experiences', ex);
    console.log('Imported experiences:', ex.length);
  } else {
    console.log('[seed] No experiences.json or empty array — not writing experiences collection.');
  }

  const pr = read('projects.json');
  if (Array.isArray(pr) && pr.length) {
    await cms.savePortfolio('projects', pr);
    console.log('Imported projects:', pr.length);
  } else {
    console.log('[seed] No projects.json or empty array — not writing projects collection.');
  }

  const resume = read('resume.json');
  if (resume && typeof resume === 'object') {
    await cms.setKv('resume', resume);
    console.log('Imported resume.json');
  }

  for (const { file, key } of KV_FILES) {
    const data = read(file);
    if (data == null) continue;
    if (typeof data !== 'object' || Array.isArray(data)) {
      console.warn('[seed] Skip', file, '(expected a JSON object).');
      continue;
    }
    await cms.setKv(key, data);
    console.log('Imported data/' + file, '→', key);
  }

  const resumeMdPath = path.join(ROOT, 'public', 'resume.md');
  if (fs.existsSync(resumeMdPath)) {
    const content = fs.readFileSync(resumeMdPath, 'utf8');
    await cms.setKv('resume_markdown', { content });
    console.log('Imported public/resume.md → resume_markdown');
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
