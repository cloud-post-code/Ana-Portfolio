#!/usr/bin/env node
/**
 * One-time import from data/*.json into PostgreSQL.
 * Requires DATABASE_URL. Run: node scripts/seed-pg-from-json.js
 */

const fs = require('fs');
const path = require('path');

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('Set DATABASE_URL to your Postgres connection string.');
    process.exit(1);
  }
  await require('../lib/db').initDb();
  const cms = require('../lib/cms-store');
  const dataDir = path.join(__dirname, '..', 'data');

  function read(name) {
    const p = path.join(dataDir, name);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  }

  const jobs = read('jobs-crm.json');
  if (Array.isArray(jobs) && jobs.length) {
    await cms.saveJobsCrm(jobs);
    console.log('Imported jobs-crm:', jobs.length);
  }

  const ex = read('experiences.json');
  if (Array.isArray(ex) && ex.length) {
    await cms.savePortfolio('experiences', ex);
    console.log('Imported experiences:', ex.length);
  }

  const pr = read('projects.json');
  if (Array.isArray(pr) && pr.length) {
    await cms.savePortfolio('projects', pr);
    console.log('Imported projects:', pr.length);
  }

  const resume = read('resume.json');
  if (resume && typeof resume === 'object') {
    await cms.setKv('resume', resume);
    console.log('Imported resume.json');
  }

  const profile = read('job-search-profile.json');
  if (profile && typeof profile === 'object') {
    await cms.setKv('job_search_profile', profile);
    console.log('Imported job-search-profile.json');
  }

  const resumeMdPath = path.join(__dirname, '..', 'public', 'resume.md');
  if (fs.existsSync(resumeMdPath)) {
    const content = fs.readFileSync(resumeMdPath, 'utf8');
    await cms.setKv('resume_markdown', { content });
    console.log('Imported public/resume.md');
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(function (e) {
  console.error(e);
  process.exit(1);
});
