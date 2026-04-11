/**
 * Parse the Job Hunter "Open Roles" markdown pipe table into row objects aligned
 * with the admin Job CRM table columns.
 */

const EXPECTED_HEADERS =
  '| # | Company | Role | Yrs exp | Job details | Location | Deadline | Status | Priority | Tags | Listing |';

function splitPipeRow(line) {
  const raw = String(line || '').trim();
  if (!raw.startsWith('|')) return [];
  const inner = raw.slice(1, raw.endsWith('|') ? -1 : undefined);
  const cells = inner.split('|');
  return cells.map(function (c) {
    return c.replace(/\\\|/g, '|').trim();
  });
}

function normalizeHeaderCell(h) {
  return String(h || '')
    .replace(/[\uFEFF\u200B]/g, '')
    .replace(/^[^\w#]+/, '')
    .trim()
    .toLowerCase();
}

function headerToFieldKey(h) {
  const n = normalizeHeaderCell(h);
  if (n === '#' || n === 'no.' || n === 'no' || /^#\s*$/.test(h)) return 'idx';
  if (n === 'co' || n.includes('company')) return 'co';
  if (n.includes('role') || n.includes('title') || n === 'job') return 'role';
  if (n.includes('yrs') || n.includes('yoe') || n.includes('years') || n.includes('exp')) return 'yoe';
  if (n.includes('detail') || n.includes('notes') || n.includes('summary')) return 'notes';
  if (n.includes('locat') || n === 'loc' || n.includes('city')) return 'loc';
  if (n.includes('deadline') || n.includes('closes')) return 'deadline';
  if (n.includes('status') || n === 'st') return 'st';
  if (n.includes('prior')) return 'pri';
  if (n.includes('tag') || n.includes('label')) return 'tags';
  if (n.includes('list') || n.includes('url') || n.includes('apply') || n.includes('link')) return 'url';
  return null;
}

function isSeparatorRow(line) {
  const s = String(line || '').replace(/\|/g, '').trim();
  if (!s) return false;
  return /^[\s:\-]+$/.test(s);
}

/**
 * @param {string} text Full Claude report (markdown)
 * @returns {{ rows: Array<Record<string, string>>, headerLine: string }}
 */
function parseOpenRolesTable(text) {
  const rows = [];
  const lines = String(text || '').split(/\r?\n/);

  let headerIdx = -1;
  let headers = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('|')) continue;
    const cells = splitPipeRow(line);
    if (cells.length < 3) continue;

    const keys = cells.map(headerToFieldKey);
    const hit = keys.filter(Boolean).length;
    if (hit >= 4 && keys.some(k => k === 'co') && keys.some(k => k === 'role')) {
      headerIdx = i;
      headers = cells.map(function (c, j) {
        return headerToFieldKey(c) || 'col' + j;
      });
      break;
    }
  }

  if (headerIdx === -1) {
    return { rows: [], headerLine: EXPECTED_HEADERS };
  }

  let i = headerIdx + 1;
  if (i < lines.length && isSeparatorRow(lines[i])) {
    i++;
  }

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) {
      if (line.trim() === '' || line.trim().startsWith('#')) break;
      continue;
    }
    const cells = splitPipeRow(line);
    if (cells.length === 0) continue;

    const obj = {};
    const n = Math.min(headers.length, cells.length);
    for (let j = 0; j < n; j++) {
      const key = headers[j];
      if (!key || String(key).startsWith('col')) continue;
      obj[key] = cells[j] != null ? String(cells[j]).trim() : '';
    }
    if (obj.co || obj.role || obj.url) {
      rows.push(obj);
    }
  }

  return {
    rows,
    headerLine: EXPECTED_HEADERS
  };
}

module.exports = {
  parseOpenRolesTable,
  EXPECTED_HEADERS
};
