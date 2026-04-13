/**
 * Second Claude pass: verify and enrich Open Roles rows using fetched listing page text.
 */

const { anthropicMessageText } = require('./anthropic-text');
const { fetchUrlAsPlainText } = require('./resolve-employer-url');
const { ENRICH_BATCH_JSON_SCHEMA } = require('./schemas/job-hunter-enrich');

const MAX_LISTING_CHARS = 6000;
/** Default cap when `maxRows` is not passed (backward compatible). */
const MAX_ROWS_ENRICH = 12;
const MAX_ENRICH_ROWS_CAP = 25;

function effectiveEnrichMaxRows(opts) {
  if (!opts || opts.maxRows == null) return MAX_ROWS_ENRICH;
  const n = parseInt(String(opts.maxRows), 10);
  if (Number.isNaN(n)) return MAX_ROWS_ENRICH;
  return Math.min(MAX_ENRICH_ROWS_CAP, Math.max(1, n));
}

function parseJsonFromLlm(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('Empty enrich response');
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  return JSON.parse(t);
}

async function completeAnthropicEnrich(system, user, rowCount) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY required');
  const model = process.env.JOB_HUNTER_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  const n = typeof rowCount === 'number' && rowCount > 0 ? rowCount : 1;
  const maxTokens = n > 12 ? 16384 : 8192;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      temperature: 0.15,
      system: system,
      messages: [{ role: 'user', content: user }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: ENRICH_BATCH_JSON_SCHEMA
        }
      }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Anthropic enrich error: ' + res.status + ' ' + errText.slice(0, 280));
  }
  const data = await res.json();
  const text = anthropicMessageText(data);
  return parseJsonFromLlm(text);
}

async function completeOpenAIEnrich(system, user, rowCount) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) throw new Error('OPENAI_API_KEY required');
  const n = typeof rowCount === 'number' && rowCount > 0 ? rowCount : 1;
  const maxTokens = n > 12 ? 16384 : 8192;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.15,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'job_hunter_enrich_batch',
          strict: true,
          schema: ENRICH_BATCH_JSON_SCHEMA
        }
      }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('OpenAI enrich error: ' + res.status + ' ' + errText.slice(0, 280));
  }
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) throw new Error('Empty OpenAI enrich content');
  return parseJsonFromLlm(text);
}

function mergeEnrichedRow(base, enriched) {
  const out = Object.assign({}, base);
  if (!enriched || typeof enriched !== 'object') return out;
  const strKeys = ['co', 'role', 'loc', 'notes', 'url', 'deadline', 'yoe'];
  strKeys.forEach(function (k) {
    const v = enriched[k];
    if (typeof v === 'string' && v.trim() !== '') {
      out[k] = v.trim();
    }
  });
  if (Array.isArray(enriched.tags) && enriched.tags.length > 0) {
    out.tags = enriched.tags
      .map(function (s) {
        return String(s).trim();
      })
      .filter(Boolean)
      .slice(0, 25)
      .join(', ');
  }
  return out;
}

/**
 * @param {Array<Record<string, string>>} rows - parsed Open Roles (before defaults)
 * @param {{ maxRows?: number }} [opts] - cap rows to enrich (default 12, max 25)
 * @returns {Promise<Array<Record<string, string>>>}
 */
async function enrichOpenRolesRows(rows, opts) {
  if (
    process.env.JOB_HUNTER_DISABLE_ENRICH === '1' ||
    String(process.env.JOB_HUNTER_DISABLE_ENRICH || '').toLowerCase() === 'true'
  ) {
    return rows;
  }

  const enrichCap = effectiveEnrichMaxRows(opts);
  const slice = rows.slice(0, enrichCap);
  if (!slice.length) return rows;

  const listingBlocks = [];
  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    const u = String(row.url || '').trim();
    let page = '';
    if (u && u !== '—' && /^https?:\/\//i.test(u)) {
      page = await fetchUrlAsPlainText(u);
    }
    listingBlocks.push({
      originalIdx: i,
      row: row,
      pageExcerpt: page ? page.slice(0, MAX_LISTING_CHARS) : '(no listing page fetched — use snippets only)'
    });
  }

  const system = [
    'You verify and enrich job-lead rows for a portfolio CRM. Output MUST match the JSON Schema.',
    'For each row: use the listing excerpt when present; otherwise rely on the row snapshot + Tavily snippet block.',
    'Correct company, role, location, YoE, deadline only when supported by the excerpt or snippets.',
    'Expand `notes` so it is sufficient for resume tailoring and cover letter writing: 2–4 short bullet-style sentences covering responsibilities, must-have qualifications, tools/stack, work arrangement (remote/hybrid), comp only if explicitly stated, and how to apply.',
    'Extract `deadline` as ISO date (YYYY-MM-DD), the text "Rolling" only if the posting says rolling/no close, or empty string if unknown.',
    'Extract `yoe` as the exact experience phrase from the posting (e.g. "2+ years", "Entry level"). Empty string if not stated.',
    'Prefer employer/ATS `url` from the excerpt if it is a direct apply link; otherwise keep the input URL.',
    'Every output row MUST include originalIdx matching the input index (0-based within this batch).',
    'Use empty string for unknown string fields; tags may be empty array.'
  ].join('\n');

  const user =
    'Input rows (JSON):\n' +
    JSON.stringify(
      listingBlocks.map(function (b) {
        return {
          originalIdx: b.originalIdx,
          snapshot: b.row,
          listingPageExcerpt: b.pageExcerpt
        };
      }),
      null,
      2
    );

  let parsed;
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      parsed = await completeAnthropicEnrich(system, user, slice.length);
    } else if (process.env.OPENAI_API_KEY) {
      parsed = await completeOpenAIEnrich(system, user, slice.length);
    } else {
      return rows;
    }
  } catch (e) {
    console.warn('[job-hunter-enrich] failed, returning pre-enrich rows:', e.message || e);
    return rows;
  }

  const enrichedList = parsed && parsed.rows && Array.isArray(parsed.rows) ? parsed.rows : [];
  const byIdx = new Map();
  enrichedList.forEach(function (r) {
    if (r && typeof r.originalIdx === 'number' && r.originalIdx >= 0) {
      byIdx.set(r.originalIdx, r);
    }
  });

  const out = rows.slice();
  for (let i = 0; i < slice.length; i++) {
    const er = byIdx.get(i);
    if (er) {
      out[i] = mergeEnrichedRow(out[i], er);
    }
  }
  return out;
}

module.exports = { enrichOpenRolesRows, MAX_ROWS_ENRICH, MAX_ENRICH_ROWS_CAP };
