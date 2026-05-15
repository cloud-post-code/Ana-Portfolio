#!/usr/bin/env node
/**
 * Normalize portfolio items to the post-redesign schema:
 * - Drop deprecated keys (sectionLabel, headerStyle, meta, logoWide, type, company).
 * - Merge legacy subtitle/meta/type/company into a single `subtitle` where helpful.
 * - Deliverables: map galleryClass → gridColumns, remove galleryClass.
 *
 * Usage:
 *   node scripts/migrate-portfolio-schema.js           # rewrite data/*.json only
 *   node scripts/migrate-portfolio-schema.js --database  # rewrite Postgres (needs DATABASE_URL)
 *
 * Railway: from a linked service with DATABASE_URL:
 *   railway run node scripts/migrate-portfolio-schema.js --database
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');

function galleryClassToGridColumns(galleryClass) {
  const gc = String(galleryClass || '');
  if (gc.includes('farout-social')) return '3';
  const m = gc.match(/cols[_-]?(\d)/i);
  if (m && /^[1-4]$/.test(m[1])) return m[1];
  return '';
}

function migrateDeliverable(del) {
  const existing = del.gridColumns != null && del.gridColumns !== '' ? String(del.gridColumns) : '';
  let cols = existing && /^[1-4]$/.test(existing) ? existing : '';
  if (!cols) cols = galleryClassToGridColumns(del.galleryClass);
  const { galleryClass: _gc, ...rest } = del;
  const out = { ...rest };
  if (cols && /^[1-4]$/.test(cols)) out.gridColumns = cols;
  else delete out.gridColumns;
  return out;
}

const PLACEHOLDER_COMPANY = /^details\s+coming\s+soon/i;

function migrateExperienceSubtitle(item) {
  const subtitle = String(item.subtitle || '').trim();
  const meta = String(item.meta || '').trim();
  const type = String(item.type || '').trim();
  const company = String(item.company || '').trim();

  const chunks = [];
  if (subtitle) chunks.push(subtitle);
  if (meta && (!subtitle || !subtitle.includes(meta))) chunks.push(meta);

  const bare = !subtitle && !meta;
  if (bare) {
    if (type) chunks.push(type);
    if (company && !PLACEHOLDER_COMPANY.test(company)) chunks.push(company);
  } else if (company && !PLACEHOLDER_COMPANY.test(company)) {
    const joined = chunks.join(' — ');
    if (!joined.includes(company)) chunks.push(company);
  }
  return chunks.join(' — ').trim();
}

function migrateProjectSubtitle(item) {
  const subtitle = String(item.subtitle || '').trim();
  const meta = String(item.meta || '').trim();
  const sectionLabel = String(item.sectionLabel || '').trim();

  const chunks = [];
  if (subtitle) chunks.push(subtitle);
  if (meta && (!subtitle || !subtitle.includes(meta))) chunks.push(meta);
  if (!chunks.length && sectionLabel === 'Academic project') chunks.push('Academic project');
  return chunks.join(' — ').trim();
}

function stripDeprecated(item, mergedSubtitle) {
  const o = { ...item };
  delete o.sectionLabel;
  delete o.headerStyle;
  delete o.meta;
  delete o.logoWide;
  delete o.type;
  delete o.company;

  if (mergedSubtitle) o.subtitle = mergedSubtitle;
  else delete o.subtitle;

  if (o.role === '') delete o.role;
  if (o.dateRange === '') delete o.dateRange;

  o.deliverables = (o.deliverables || []).map(migrateDeliverable);
  return o;
}

function migrateProject(item) {
  const merged = migrateProjectSubtitle(item);
  return stripDeprecated(item, merged);
}

function migrateExperience(item) {
  const merged = migrateExperienceSubtitle(item);
  return stripDeprecated(item, merged);
}

function migrateJsonFile(name, migrateRow) {
  const fp = path.join(DATA_DIR, name);
  const raw = JSON.parse(fs.readFileSync(fp, 'utf8'));
  if (!Array.isArray(raw)) throw new Error(name + ': expected array');
  const out = raw.map(migrateRow);
  fs.writeFileSync(fp, JSON.stringify(out, null, 2) + '\n');
  console.log('[migrate] Wrote', out.length, 'rows →', path.relative(ROOT, fp));
}

async function migrateDatabase() {
  if (!process.env.DATABASE_URL || !String(process.env.DATABASE_URL).trim()) {
    console.error('[migrate] DATABASE_URL is not set. Use: railway run node scripts/migrate-portfolio-schema.js --database');
    process.exit(1);
  }
  await require('../lib/db').initDb();
  const cms = require('../lib/cms-store');
  for (const [coll, fn] of [
    ['projects', migrateProject],
    ['experiences', migrateExperience]
  ]) {
    const items = await cms.getPortfolio(coll);
    const out = items.map(fn);
    await cms.savePortfolio(coll, out);
    console.log('[migrate] PostgreSQL', coll + ':', out.length, 'rows updated');
  }
}

async function main() {
  const db = process.argv.includes('--database');
  if (db) {
    await migrateDatabase();
    return;
  }
  migrateJsonFile('projects.json', migrateProject);
  migrateJsonFile('experiences.json', migrateExperience);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
