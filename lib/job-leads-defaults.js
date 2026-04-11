/**
 * Normalize Open Roles rows when the model leaves fields blank — use CRM-friendly defaults.
 */

const UNKNOWN = '—';

function trimOrEmpty(v) {
  return v != null ? String(v).trim() : '';
}

function normalizePriority(pri) {
  const pl = trimOrEmpty(pri).toLowerCase();
  if (pl === 'high') return 'High';
  if (pl === 'low') return 'Low';
  if (pl === 'medium') return 'Medium';
  return 'Medium';
}

/**
 * @param {Record<string, string> & { verificationIssues?: string[] }} row
 * @param {number} index 0-based row index in the table
 */
function applyOpenRoleDefaultsOne(row, index) {
  const out = {};
  const issues = row.verificationIssues;

  out.idx = trimOrEmpty(row.idx) || String(index + 1);
  out.co = trimOrEmpty(row.co) || UNKNOWN;
  out.role = trimOrEmpty(row.role) || UNKNOWN;
  out.yoe = trimOrEmpty(row.yoe) || UNKNOWN;
  out.notes = trimOrEmpty(row.notes) || UNKNOWN;
  out.loc = trimOrEmpty(row.loc) || UNKNOWN;
  out.deadline = trimOrEmpty(row.deadline) || UNKNOWN;
  out.st = trimOrEmpty(row.st) || 'To Apply';
  out.pri = normalizePriority(row.pri);
  out.tags = trimOrEmpty(row.tags) || UNKNOWN;
  const u = trimOrEmpty(row.url);
  out.url = u || UNKNOWN;

  if (issues && issues.length) {
    out.verificationIssues = issues;
  }
  return out;
}

/**
 * @param {Array<Record<string, string> & { verificationIssues?: string[] }>} rows
 */
function applyOpenRoleDefaults(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.map(function (row, i) {
    return applyOpenRoleDefaultsOne(row, i);
  });
}

module.exports = {
  applyOpenRoleDefaults,
  applyOpenRoleDefaultsOne,
  UNKNOWN
};
