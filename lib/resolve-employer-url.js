/**
 * Resolve employer / ATS apply URLs from job-board pages (Indeed, LinkedIn, Glassdoor)
 * by fetching the page via Jina Reader and scanning for known ATS patterns.
 */

const JINA_PREFIX = 'https://r.jina.ai/';
const FETCH_TIMEOUT_MS = 25000;
const MAX_TEXT = 18000;

/** Same extraction pattern as enhance-service (duplicated to avoid circular require). */
function extractHttpUrls(text) {
  const s = String(text || '');
  const re = /https?:\/\/[^\s\])"'<>]+/gi;
  const out = [];
  const seen = new Set();
  let m;
  while ((m = re.exec(s))) {
    let u = m[0].replace(/[.,;:!?)]+$/g, '');
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function isBoardSingleJobUrl(url) {
  const u = String(url || '')
    .trim()
    .toLowerCase();
  if (!/^https?:\/\//i.test(u)) return false;
  if (/indeed\.com\/(viewjob|rc\/clk)/i.test(u)) return true;
  if (/linkedin\.com\/jobs\/view\//i.test(u)) return true;
  if (/glassdoor\.com\/job-listing\//i.test(u) || /glassdoor\.com\/job\//i.test(u)) return true;
  return false;
}

const ATS_HOST_PATTERNS = [
  /greenhouse\.io/i,
  /boards\.greenhouse\.io/i,
  /lever\.co/i,
  /jobs\.lever\.co/i,
  /myworkdayjobs\.com/i,
  /workday\.com\/.*\/job/i,
  /icims\.com/i,
  /smartrecruiters\.com/i,
  /ashbyhq\.com/i,
  /bamboohr\.com\/careers/i,
  /applytojob\.com/i,
  /jobvite\.com/i,
  /taleo\.net/i,
  /ultipro\.com/i,
  /rippling-ats/i,
  /rippling\.com\/.*\/jobs/i
];

function isLikelyAtsOrCareersUrl(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  const lower = u.toLowerCase();
  for (let i = 0; i < ATS_HOST_PATTERNS.length; i++) {
    if (ATS_HOST_PATTERNS[i].test(lower)) return true;
  }
  if (/\/careers\//i.test(lower) || /\/jobs\//i.test(lower) || /\/job\//i.test(lower)) {
    if (!/(indeed|linkedin|glassdoor|monster|ziprecruiter|simplyhired)\./i.test(lower)) {
      return true;
    }
  }
  return false;
}

function isBadAggregatorUrl(url) {
  const lower = String(url || '')
    .toLowerCase();
  if (/indeed\.com\/(jobs\?|q-)/i.test(lower)) return true;
  if (/linkedin\.com\/jobs\/(search|collections)/i.test(lower)) return true;
  return false;
}

/**
 * True when path is only `/careers` or `/jobs` on the host (no job slug)—not a specific apply link.
 */
function isLikelyGenericCareersOrJobsHub(url) {
  const u = String(url || '').trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const p = new URL(u);
    const segments = p.pathname
      .replace(/\/$/, '')
      .split('/')
      .filter(Boolean);
    return segments.length === 1 && /^(careers|jobs)$/i.test(segments[0]);
  } catch (e) {
    return false;
  }
}

/**
 * Prefer concrete ATS / apply URLs over generic career pages when scanning HTML text (e.g. from Indeed).
 */
function scoreApplyUrlCandidate(url) {
  const u = String(url || '').trim();
  if (!u || isBadAggregatorUrl(u)) return -100;
  let s = 0;
  const lower = u.toLowerCase();
  if (/boards\.greenhouse\.io\/[^/]+\/jobs\/\d+/i.test(u)) s += 15;
  else if (/greenhouse\.io\/.*\/jobs\/\d+/i.test(u)) s += 13;
  if (/jobs\.lever\.co\/[^/]+\/[^/?]+/i.test(u)) s += 15;
  if (/myworkdayjobs\.com\/[^/]+\/job\//i.test(u)) s += 14;
  if (/ashbyhq\.com\/[^/]+\/\d+/i.test(u)) s += 13;
  if (/smartrecruiters\.com\/[^/]+\/[^/?]+/i.test(u)) s += 12;
  if (/icims\.com\/.*\/jobs\/\d+/i.test(u)) s += 12;
  if (/bamboohr\.com\/careers\/\d+/i.test(u)) s += 11;
  if (/\/apply(\/|\?|$|#)/i.test(u) || /\/application\//i.test(u)) s += 8;
  if (isLikelyAtsOrCareersUrl(u)) s += 4;
  if (/linkedin\.com\/jobs\/view\//i.test(lower)) s += 4;
  if (/indeed\.com\/(viewjob|rc\/clk)/i.test(lower)) s += 3;
  if (/glassdoor\.com\/(job-listing|job)\//i.test(lower)) s += 3;
  if (isLikelyGenericCareersOrJobsHub(u)) s -= 12;
  return s;
}

async function fetchUrlAsPlainText(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const jinaUrl = JINA_PREFIX + encodeURIComponent(url);
    const ctrl = new AbortController();
    const t = setTimeout(function () {
      ctrl.abort();
    }, FETCH_TIMEOUT_MS);
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, MAX_TEXT);
  } catch (e) {
    return '';
  }
}

/**
 * Per-request cache so resolve + enrich do not fetch the same URL twice.
 * @param {Map<string, string>|undefined} cache
 */
async function fetchUrlAsPlainTextCached(url, cache) {
  const k = String(url || '').trim();
  if (!k || !/^https?:\/\//i.test(k)) return '';
  if (cache && cache.has(k)) {
    return cache.get(k);
  }
  const text = await fetchUrlAsPlainText(k);
  if (cache) {
    cache.set(k, text || '');
  }
  return text || '';
}

/**
 * Fetch every listing page (Jina), then prefer a stronger apply/ATS URL from the HTML text when it beats the original.
 * @param {Map<string, string>|undefined} cache
 * @returns {Promise<{ resolved: string, source: 'ats' | 'original' }>}
 */
async function resolveEmployerListingUrl(listingUrl, cache) {
  const original = String(listingUrl || '').trim();
  if (!original || original === '—') {
    return { resolved: '', source: 'original' };
  }
  if (!/^https?:\/\//i.test(original)) {
    return { resolved: original, source: 'original' };
  }
  if (isBadAggregatorUrl(original)) {
    return { resolved: original, source: 'original' };
  }

  const pageText = await fetchUrlAsPlainTextCached(original, cache);
  const best = extractBestAtsUrlFromPageText(pageText);
  const origScore = scoreApplyUrlCandidate(original);

  if (best && best !== original) {
    const bestScore = scoreApplyUrlCandidate(best);
    if (bestScore > origScore) {
      return { resolved: best, source: 'ats' };
    }
  }

  return { resolved: original, source: 'original' };
}

/** Best apply/ATS URL in fetched page text (no network I/O). */
function extractBestAtsUrlFromPageText(pageText) {
  const urls = extractHttpUrls(pageText || '');
  let best = '';
  let bestScore = -Infinity;
  for (let i = 0; i < urls.length; i++) {
    const u = urls[i];
    if (isBadAggregatorUrl(u)) continue;
    const sc = scoreApplyUrlCandidate(u);
    if (sc > bestScore) {
      bestScore = sc;
      best = u;
    }
  }
  if (best && bestScore > 0) {
    return best;
  }
  for (let j = 0; j < urls.length; j++) {
    const u2 = urls[j];
    if (isBadAggregatorUrl(u2)) continue;
    if (isLikelyAtsOrCareersUrl(u2)) {
      return u2;
    }
  }
  return '';
}

/**
 * Resolve listing URLs on CRM-style rows (limited concurrency).
 * @param {Array<Record<string, string>>} rows
 * @param {number} [concurrency]
 * @param {Map<string, string>|undefined} [listingFetchCache] - optional URL → Jina text for this request
 */
async function resolveUrlsOnRows(rows, concurrency, listingFetchCache) {
  const n = typeof concurrency === 'number' && concurrency > 0 ? concurrency : 4;
  const list = Array.isArray(rows) ? rows : [];
  const out = [];
  for (let i = 0; i < list.length; i += n) {
    const chunk = list.slice(i, i + n);
    const done = await Promise.all(
      chunk.map(async function (row) {
        const u = String(row.url || '').trim();
        if (!u || u === '—' || !/^https?:\/\//i.test(u)) {
          return row;
        }
        const { resolved } = await resolveEmployerListingUrl(u, listingFetchCache);
        return Object.assign({}, row, { url: resolved || u });
      })
    );
    out.push.apply(out, done);
  }
  return out;
}

module.exports = {
  resolveEmployerListingUrl,
  resolveUrlsOnRows,
  fetchUrlAsPlainText,
  fetchUrlAsPlainTextCached,
  extractHttpUrls,
  extractBestAtsUrlFromPageText,
  isBoardSingleJobUrl,
  isLikelyAtsOrCareersUrl,
  isLikelyGenericCareersOrJobsHub
};
