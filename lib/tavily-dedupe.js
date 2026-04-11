/**
 * Deduplicate Tavily API result rows (same listing often appears twice with different snippets).
 */

function normalizeUrl(u) {
  const s = String(u || '').trim();
  if (!s) return '';
  try {
    const x = new URL(s);
    x.hash = '';
    let h = x.href;
    if (h.endsWith('/') && x.pathname !== '/') h = h.replace(/\/$/, '');
    return h;
  } catch (e) {
    return s;
  }
}

/**
 * @param {Array<{ url?: string, title?: string, content?: string }>} results
 * @returns {typeof results}
 */
function dedupeTavilyResults(results) {
  const list = Array.isArray(results) ? results : [];
  const seen = new Set();
  const out = [];
  list.forEach(function (r) {
    const urlKey = normalizeUrl(r.url);
    const fallback = [String(r.title || '').toLowerCase().slice(0, 120), String(r.content || '').slice(0, 160)].join('|');
    const key = urlKey || fallback;
    if (!key.trim()) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(r);
  });
  return out;
}

module.exports = { dedupeTavilyResults, normalizeUrl };
