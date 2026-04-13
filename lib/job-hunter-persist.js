/**
 * Append Job Hunter Open Roles into data/jobs-crm.json with deduping.
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function dataPath(filename) {
  return path.join(DATA_DIR, filename);
}

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function tripleKey(co, role, loc) {
  return norm(co) + '|' + norm(role) + '|' + norm(loc);
}

function normalizeUrlKey(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return '';
  try {
    const o = new URL(u);
    return (o.origin + o.pathname.replace(/\/$/, '')).toLowerCase();
  } catch (e) {
    return u.split('?')[0].replace(/\/$/, '').toLowerCase();
  }
}

function normalizePri(pri) {
  const pl = String(pri || '')
    .trim()
    .toLowerCase();
  if (pl === 'high') return 'High';
  if (pl === 'low') return 'Low';
  return 'Medium';
}

function tagsFromRow(row) {
  const t = row.tags;
  if (Array.isArray(t)) {
    return t
      .map(function (x) {
        return String(x || '').trim();
      })
      .filter(Boolean)
      .slice(0, 16);
  }
  const s = String(t || '').trim();
  if (!s || s === '—') return [];
  return s
    .split(/[,;]/)
    .map(function (x) {
      return x.trim();
    })
    .filter(Boolean)
    .slice(0, 16);
}

function nextJobId(jobs) {
  let max = 0;
  for (let i = 0; i < jobs.length; i++) {
    const m = /^j(\d+)$/.exec(String((jobs[i] && jobs[i].id) || ''));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  if (max > 0) return 'j' + (max + 1);
  return 'j' + (jobs.length + 1);
}

const EM_DASH = '—';

function cleanField(s) {
  const t = String(s == null ? '' : s).trim();
  return t === EM_DASH ? '' : t;
}

/**
 * @param {string} filename - e.g. jobs-crm.json
 * @param {Array<Record<string, unknown>>} openRoles - rows after applyOpenRoleDefaults
 * @returns {{ added: number, skipped: number, newIds: string[] }}
 */
function mergeJobHunterOpenRolesIntoCrm(filename, openRoles) {
  const out = { added: 0, skipped: 0, newIds: [] };
  if (!Array.isArray(openRoles) || !openRoles.length) {
    return out;
  }

  let data = [];
  try {
    const raw = fs.readFileSync(dataPath(filename), 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) data = parsed;
  } catch (e) {
    data = [];
  }

  const seenUrl = new Set();
  const seenTriple = new Set();

  data.forEach(function (j) {
    const uk = normalizeUrlKey(j.url);
    if (uk) seenUrl.add(uk);
    seenTriple.add(tripleKey(j.co, j.role, j.loc));
  });

  for (let r = 0; r < openRoles.length; r++) {
    const row = openRoles[r];
    const co = cleanField(row.co);
    const role = cleanField(row.role);
    const loc = cleanField(row.loc);
    let url = cleanField(row.url);
    if (!/^https?:\/\//i.test(url)) url = '';

    if (!co || !role) {
      out.skipped++;
      continue;
    }

    const notesRaw = String(row.notes != null ? row.notes : '')
      .trim()
      .slice(0, 8000);
    const notesForCrm = notesRaw && notesRaw !== EM_DASH ? notesRaw : EM_DASH;

    if (!url && (!notesRaw || notesRaw === EM_DASH)) {
      out.skipped++;
      continue;
    }

    const tk = tripleKey(co, role, loc || EM_DASH);
    if (seenTriple.has(tk)) {
      out.skipped++;
      continue;
    }

    const uk = url ? normalizeUrlKey(url) : '';
    if (uk && seenUrl.has(uk)) {
      out.skipped++;
      continue;
    }

    if (uk) seenUrl.add(uk);
    seenTriple.add(tk);

    const id = nextJobId(data);
    const tagList = tagsFromRow(row);
    const job = {
      id: id,
      t: 'job',
      co: co,
      role: role,
      loc: loc || EM_DASH,
      st: String(row.st || 'To Apply').trim().slice(0, 120) || 'To Apply',
      pri: normalizePri(row.pri),
      notes: notesForCrm,
      url: url,
      tags: tagList.length ? tagList : ['Job Hunter'],
      starred: false
    };

    const dl = cleanField(row.deadline);
    job.deadline = dl ? dl.slice(0, 120) : EM_DASH;
    const yoe = cleanField(row.yoe);
    job.yoe = yoe ? yoe.slice(0, 60) : EM_DASH;

    data.push(job);
    out.added++;
    out.newIds.push(id);
  }

  if (out.added > 0) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(dataPath(filename), JSON.stringify(data, null, 2));
  }

  return out;
}

module.exports = {
  mergeJobHunterOpenRolesIntoCrm,
  tripleKey,
  normalizeUrlKey
};
