/**
 * Heuristic checks on Job Hunter Open Roles rows (server-side double-check).
 * Complements model instructions; flags issues for the admin UI.
 */

const {
  isLikelyAtsOrCareersUrl,
  isLikelyGenericCareersOrJobsHub
} = require('./resolve-employer-url');

/**
 * URLs that point to search / aggregation pages, not a single apply destination.
 * (Aligned with enhance-service heuristics.)
 */
function isGoogleSearchFallbackUrl(url) {
  const u = String(url || '').trim().toLowerCase();
  return /^https?:\/\/(www\.)?google\.[a-z.]+\/search\?/i.test(u);
}

function isLikelyBadJobListingUrl(url) {
  const u = String(url || '')
    .trim()
    .toLowerCase();
  if (!u) return true;
  if (!/^https?:\/\//i.test(u)) return true;
  if (/^https?:\/\/jobs\.mit\.edu\/?$/i.test(String(url || '').trim())) return true;

  const badSubstrings = [
    'indeed.com/q-',
    'indeed.com/jobs?',
    'linkedin.com/jobs/collections',
    'linkedin.com/jobs/search',
    'glassdoor.com/browsejoblistings',
    'glassdoor.com/job-list',
    'simplyhired.com/search',
    'ziprecruiter.com/jobs-search',
    'ziprecruiter.com/candidate/search',
    'monster.com/jobs/search',
    'careerbuilder.com/jobs?'
  ];
  for (let i = 0; i < badSubstrings.length; i++) {
    if (u.includes(badSubstrings[i])) return true;
  }
  if (/linkedin\.com\/jobs\//.test(u) && !/\/jobs\/view\//.test(u)) return true;
  return false;
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

function parseDeadlineMaybePast(deadline) {
  const d = String(deadline || '').trim();
  if (!d || d === '—' || /^rolling$/i.test(d)) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
  if (!iso) return null;
  const t = Date.UTC(parseInt(iso[1], 10), parseInt(iso[2], 10) - 1, parseInt(iso[3], 10));
  return t;
}

function companySeemsUnrelatedToHost(co, url) {
  if (!co || !url || url === '—') return false;
  if (isLikelyAtsOrCareersUrl(url) || isLikelyBadJobListingUrl(url)) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    const brand = norm(co).replace(/[^a-z0-9\s]/g, ' ');
    const words = brand.split(/\s+/).filter(function (w) {
      return w.length >= 4;
    });
    if (!words.length) return false;
    const hostFlat = host.replace(/[^a-z0-9]/g, '');
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (hostFlat.includes(w) || host.includes(w.slice(0, 5))) return false;
    }
    return true;
  } catch (e) {
    return false;
  }
}

function urlInText(url, haystack) {
  const u = String(url || '').trim();
  if (!u || !haystack) return false;
  if (haystack.includes(u)) return true;
  try {
    const noQuery = u.split('?')[0].replace(/\/$/, '');
    if (noQuery.length > 14 && haystack.includes(noQuery)) return true;
  } catch (e) {
    /* ignore */
  }
  return false;
}

/**
 * @param {Array<Record<string, string>>} rows
 * @param {{ webSnippets?: string, existingJobs?: Array<{ co?: string, role?: string, loc?: string, url?: string }> }} ctx
 * @returns {Array<Record<string, string> & { verificationIssues?: string[] }>}
 */
function verifyOpenRoleRows(rows, ctx) {
  const webSnippets = ctx.webSnippets || '';
  const existingJobs = Array.isArray(ctx.existingJobs) ? ctx.existingJobs : [];

  const existingKeys = new Set();
  existingJobs.forEach(function (j) {
    existingKeys.add(tripleKey(j.co, j.role, j.loc));
  });

  const seenInTable = new Map();
  const seenUrls = new Map();

  return rows.map(function (row, idx) {
    const issues = [];
    const co = row.co || '';
    const role = row.role || '';
    const loc = row.loc || '';
    const url = String(row.url || '').trim();
    const dl = row.deadline != null ? String(row.deadline).trim() : '';

    const k = tripleKey(co, role, loc);
    if (co && role && loc) {
      if (existingKeys.has(k)) {
        issues.push('Same company, role, and location as a row already in Job CRM—confirm before adding.');
      }
      if (seenInTable.has(k)) {
        issues.push('Duplicate of another row in this Open Roles table.');
      }
      seenInTable.set(k, idx);
    }

    if (url && url !== '—' && /^https?:\/\//i.test(url)) {
      const normU = url.split('?')[0].replace(/\/$/, '').toLowerCase();
      if (seenUrls.has(normU)) {
        issues.push('Same listing URL as another row in this table—possible duplicate posting.');
      } else {
        seenUrls.set(normU, idx);
      }
      if (isLikelyBadJobListingUrl(url)) {
        issues.push(
          'Listing URL looks like a search page, job board hub, or non-single-job link—not a direct posting. Verify on the employer site.'
        );
      }
      if (isLikelyGenericCareersOrJobsHub(url)) {
        issues.push(
          'Listing URL looks like a generic careers or jobs landing page—use the ATS or single-job apply link for this role instead.'
        );
      }
      if (webSnippets && webSnippets.length > 80 && !urlInText(url, webSnippets)) {
        if (isGoogleSearchFallbackUrl(url)) {
          issues.push(
            'Listing is a Google search fallback (last resort)—replace with a direct job URL when you find one.'
          );
        } else {
          issues.push(
            'Listing URL was not found in the Tavily web snippets—double-check the link before applying.'
          );
        }
      }
      if (co && companySeemsUnrelatedToHost(co, url)) {
        issues.push('Listing host may not match the stated company—verify employer before applying.');
      }
    } else if (co && role && (!url || url === '—')) {
      issues.push('No direct listing URL—find the official posting on the company careers site before applying.');
    }

    const dlTs = parseDeadlineMaybePast(dl);
    if (dlTs != null && dlTs < Date.now() - 86400000) {
      issues.push('Deadline appears to be in the past—confirm whether the role is still open.');
    }

    const out = Object.assign({}, row);
    if (issues.length) {
      out.verificationIssues = issues;
    }
    return out;
  });
}

module.exports = {
  verifyOpenRoleRows,
  isLikelyBadJobListingUrl,
  isGoogleSearchFallbackUrl
};
