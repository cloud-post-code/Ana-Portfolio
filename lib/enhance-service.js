/**
 * Web-assisted field enhancement: optional Tavily search, optional Jina URL read,
 * then Anthropic or OpenAI to propose JSON patches.
 * - jobs-crm: full-row reconciliation — every tracked field is reviewed against listing + web context for accuracy.
 * - experiences / projects: fill empty or placeholder fields only (unchanged behavior).
 */

const fs = require('fs');
const path = require('path');
const { dedupeTavilyResults } = require('./tavily-dedupe');
const { anthropicMessageText } = require('./anthropic-text');
const {
  JOBS_CRM_PATCH_JSON_SCHEMA,
  stripEmptyJobCrmPatch
} = require('./schemas/jobs-crm-enhance-patch');

const DATA_FILES = {
  experiences: 'experiences.json',
  projects: 'projects.json',
  'jobs-crm': 'jobs-crm.json'
};

const ENHANCE_ALL_LIMIT = 20;

function dataFilePath(filename) {
  return path.join(__dirname, '..', 'data', filename);
}

function loadData(filename) {
  return JSON.parse(fs.readFileSync(dataFilePath(filename), 'utf8'));
}

function saveData(filename, data) {
  fs.writeFileSync(dataFilePath(filename), JSON.stringify(data, null, 2));
}

function isEmpty(val) {
  if (val == null) return true;
  if (typeof val === 'string') return !String(val).trim();
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function isPlaceholderText(val) {
  if (typeof val !== 'string') return false;
  const t = val.trim();
  return /^details\s+coming\s+soon\.?$/i.test(t) || /^tbd\.?$/i.test(t) || /^n\/a$/i.test(t);
}

/**
 * URLs that point to search / aggregation pages, not a single apply destination.
 * Replacing these is a high priority when enhancing.
 */
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
  // LinkedIn: single job posts use /jobs/view/; other /jobs/… paths are usually search or company hubs
  if (/linkedin\.com\/jobs\//.test(u) && !/\/jobs\/view\//.test(u)) return true;
  return false;
}

function jobUrlNeedsUpgrade(val) {
  return isEmpty(val) || isLikelyBadJobListingUrl(val);
}

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

/**
 * Accept only if this exact URL (or close variant) appears in fetched context — no invented links.
 */
function urlVerifiedAgainstContext(url, webContext) {
  const u = String(url || '').trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  const ctx = String(webContext || '');
  if (ctx.includes(u)) return true;
  try {
    const noQuery = u.split('?')[0].replace(/\/$/, '');
    if (noQuery.length > 12 && ctx.includes(noQuery)) return true;
  } catch (e) {
    /* ignore */
  }
  return false;
}

function fieldNeedsFill(key, val, collection) {
  if (key === 'id' || key === 'slug' || key === 'logo' || key === 'deliverables' || key === 'order') {
    return false;
  }
  if (collection === 'jobs-crm' && key === 'url') {
    return jobUrlNeedsUpgrade(val);
  }
  if (key === 'title' && collection !== 'jobs-crm') {
    return isEmpty(val) || isPlaceholderText(val);
  }
  if (key === 'skills' && collection !== 'jobs-crm') {
    return isEmpty(val) || (Array.isArray(val) && val.every(s => !String(s).trim()));
  }
  if (typeof val === 'string') {
    if (!val.trim()) return true;
    if (isPlaceholderText(val)) return true;
    if ((key === 'description' || key === 'notes') && val.trim().length < 20) return true;
  }
  if (Array.isArray(val) && key === 'tags' && val.length === 0) return true;
  return isEmpty(val);
}

function allowedKeysFor(collection) {
  if (collection === 'jobs-crm') {
    return ['co', 'role', 'loc', 'notes', 'tags', 'url', 'deadline', 'yoe'];
  }
  return [
    'title',
    'type',
    'role',
    'company',
    'dateRange',
    'description',
    'skills',
    'sectionLabel',
    'subtitle',
    'meta',
    'tileClass'
  ];
}

function listMissingFields(item, collection) {
  const allowed = allowedKeysFor(collection);
  const missing = [];
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) {
      missing.push(key);
      continue;
    }
    if (fieldNeedsFill(key, item[key], collection)) missing.push(key);
  }
  return missing;
}

/** Job CRM rows are fully re-checked against context (not only empty fields). */
function isJobsCrmFullReconcile(collection) {
  return collection === 'jobs-crm';
}

/**
 * Keys the model may output for this enhance run (sanitized against this set).
 */
function targetFieldsForEnhance(item, collection) {
  if (isJobsCrmFullReconcile(collection)) {
    return allowedKeysFor(collection);
  }
  return listMissingFields(item, collection);
}

async function fetchUrlAsMarkdown(url) {
  if (!url || !/^https?:\/\//i.test(url)) return '';
  try {
    const jinaUrl = 'https://r.jina.ai/' + encodeURIComponent(url);
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    const res = await fetch(jinaUrl, {
      headers: { Accept: 'text/plain' },
      signal: ctrl.signal
    });
    clearTimeout(t);
    if (!res.ok) return '';
    const text = await res.text();
    return text.slice(0, 14000);
  } catch (e) {
    return '';
  }
}

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return '';
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: String(query).slice(0, 400),
        search_depth: 'advanced',
        max_results: 10
      })
    });
    if (!res.ok) return '';
    const data = await res.json();
    const rows = dedupeTavilyResults(data.results || []);
    return rows
      .map(function (r) {
        return (r.title || '') + '\n' + (r.content || r.url || '');
      })
      .join('\n---\n')
      .slice(0, 12000);
  } catch (e) {
    return '';
  }
}

function buildSearchQuery(collection, item) {
  if (collection === 'jobs-crm') {
    return [item.co, item.role, item.loc, item.yoe, 'marketing job'].filter(Boolean).join(' ');
  }
  return [item.title, item.company, item.type, item.role, 'marketing student portfolio'].filter(Boolean).join(' ');
}

async function gatherWebContext(collection, item) {
  const parts = [];
  const q = buildSearchQuery(collection, item);
  const tavily = await tavilySearch(q);
  if (tavily) parts.push('=== Web search (Tavily) ===\n' + tavily);

  if (collection === 'jobs-crm' && item.url) {
    if (!isLikelyBadJobListingUrl(item.url)) {
      const page = await fetchUrlAsMarkdown(item.url);
      if (page) parts.push('=== Listing page (read via stored URL) ===\n' + page);
    } else {
      parts.push(
        '=== Note on stored URL ===\nThe saved `url` looks like a job board search or landing page, not one posting. Do not treat it as the apply link. Find a single-job or ATS URL in the search context above.'
      );
    }
  }

  return parts.join('\n\n');
}

function parseJsonFromLlm(text) {
  let t = String(text || '').trim();
  if (!t) throw new Error('Empty model response');
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  }
  try {
    return JSON.parse(t);
  } catch (e) {
    throw new Error('Model did not return valid JSON. Try again or shorten the record.');
  }
}

async function completeJsonLegacy(system, user) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
        max_tokens: 4096,
        temperature: 0.2,
        system: system,
        messages: [{ role: 'user', content: user }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Anthropic API error: ' + res.status + ' ' + errText.slice(0, 200));
    }
    const data = await res.json();
    const text = anthropicMessageText(data);
    return parseJsonFromLlm(text);
  }

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openaiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('OpenAI API error: ' + res.status + ' ' + errText.slice(0, 200));
    }
    const data = await res.json();
    const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    return parseJsonFromLlm(text);
  }

  throw new Error(
    'Set ANTHROPIC_API_KEY or OPENAI_API_KEY in the server environment. Optional: TAVILY_API_KEY for broader web search.'
  );
}

/** Anthropic Messages API: JSON Schema structured outputs (`output_config.format`). */
async function completeJsonAnthropicWithSchema(system, user, schema) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    throw new Error('ANTHROPIC_API_KEY required for structured output path');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
      max_tokens: 4096,
      temperature: 0.2,
      system: system,
      messages: [{ role: 'user', content: user }],
      output_config: {
        format: {
          type: 'json_schema',
          schema: schema
        }
      }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Anthropic API error: ' + res.status + ' ' + errText.slice(0, 280));
  }
  const data = await res.json();
  const text = anthropicMessageText(data);
  return parseJsonFromLlm(text);
}

/** OpenAI Chat Completions: `json_schema` structured outputs (strict). */
async function completeJsonOpenAIWithSchema(system, user, schema) {
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    throw new Error('OPENAI_API_KEY required for structured output path');
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + openaiKey,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'jobs_crm_enhance_patch',
          strict: true,
          schema: schema
        }
      }
    })
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error('OpenAI API error: ' + res.status + ' ' + errText.slice(0, 280));
  }
  const data = await res.json();
  const text = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!text) {
    throw new Error('Empty OpenAI message content');
  }
  return parseJsonFromLlm(text);
}

/**
 * @param {string} [collection] - For `jobs-crm`, uses provider JSON Schema when supported; falls back to legacy JSON-on-success failure.
 */
async function completeJson(system, user, collection) {
  const useJobsSchema =
    collection === 'jobs-crm' &&
    process.env.ENHANCE_JOBS_DISABLE_JSON_SCHEMA !== '1' &&
    String(process.env.ENHANCE_JOBS_DISABLE_JSON_SCHEMA || '').toLowerCase() !== 'true';

  if (useJobsSchema) {
    try {
      if (process.env.ANTHROPIC_API_KEY) {
        return await completeJsonAnthropicWithSchema(system, user, JOBS_CRM_PATCH_JSON_SCHEMA);
      }
      if (process.env.OPENAI_API_KEY) {
        return await completeJsonOpenAIWithSchema(system, user, JOBS_CRM_PATCH_JSON_SCHEMA);
      }
    } catch (e) {
      const msg = e.message || String(e);
      console.warn('[enhance jobs-crm] JSON Schema output failed, falling back to legacy JSON prompt:', msg);
      return completeJsonLegacy(system, user);
    }
  }

  return completeJsonLegacy(system, user);
}

function sanitizePatch(patch, collection, targetFieldKeys, webContext) {
  const allowed = new Set(allowedKeysFor(collection));
  const out = {};
  const allowedThisRun = new Set(targetFieldKeys);
  const ctx = String(webContext || '');
  for (const key of Object.keys(patch || {})) {
    if (!allowed.has(key) || !allowedThisRun.has(key)) continue;
    const v = patch[key];
    if (key === 'skills' || key === 'tags') {
      if (!Array.isArray(v)) continue;
      out[key] = v
        .map(function (s) {
          return String(s).trim().slice(0, 120);
        })
        .filter(Boolean)
        .slice(0, 25);
    } else if (typeof v === 'string') {
      const s = v.trim().slice(0, 8000);
      if (collection === 'jobs-crm' && key === 'url') {
        if (isLikelyBadJobListingUrl(s) || !urlVerifiedAgainstContext(s, ctx)) {
          continue;
        }
      }
      out[key] = s;
    } else {
      continue;
    }
  }
  return out;
}

function mergePatch(existing, patch, collection) {
  const out = { ...existing };
  const replaceTags = isJobsCrmFullReconcile(collection);
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (key === 'skills' || key === 'tags') {
      if (replaceTags) {
        out[key] = val;
      } else {
        const prev = Array.isArray(existing[key]) ? existing[key] : [];
        const merged = [...new Set([...prev, ...val])].slice(0, 25);
        out[key] = merged;
      }
    } else {
      out[key] = val;
    }
  }
  return out;
}

async function proposePatch(collection, item, webContext) {
  const targetFields = targetFieldsForEnhance(item, collection);
  if (targetFields.length === 0) {
    return { patch: {}, missing: [], skipped: true };
  }

  const ctx = String(webContext || '');

  const enhanceJobsJsonSchema =
    collection === 'jobs-crm' &&
    process.env.ENHANCE_JOBS_DISABLE_JSON_SCHEMA !== '1' &&
    String(process.env.ENHANCE_JOBS_DISABLE_JSON_SCHEMA || '').toLowerCase() !== 'true';

  const jobsCrmExtra =
    collection === 'jobs-crm'
      ? [
          '',
          'jobs-crm FULL RECONCILIATION (mandatory):',
          enhanceJobsJsonSchema
            ? '- **Structured JSON Schema mode:** the API returns a fixed object shape. Every field (co, role, loc, notes, url, deadline, yoe, tags) is always present. Use **empty string ""** for any string you cannot verify; use **[]** for tags when you cannot ground tags. Never invent text to avoid empties—the server strips placeholders before saving.'
            : '- Output JSON including EVERY key listed under "Fields to reconcile" that you can support from Context. Do not skip fields only because they already have values — compare each to the posting and correct mistakes (typos, wrong city, wrong title, etc.).',
          '- Primary source: the "Listing page" section when present; use Tavily for gaps or when no listing fetch.',
          '- When an existing value still matches the posting, repeat that exact value so the record stays stable.',
          '- `co`, `role`, `loc`, `yoe`, `deadline`: Must match the same vacancy; use the listing title/employer/location text when available.',
          '- `notes`: Complete, accurate summary: responsibilities, requirements, work arrangement, comp/benefits only if stated, and how to apply. If Context is thin, say so explicitly and avoid invented details.',
          '- `tags`: Replace with a fresh list (3–12) of short phrases drawn from the role (skills, level, industry) — not a union with stale tags unless still accurate.',
          enhanceJobsJsonSchema
            ? '- `url`: Copy EXACTLY from Context (Tavily or Listing page). Use **""** if only search/collection pages or unverified links. Never fabricate.'
            : '- `url`: Must be copied EXACTLY from Context (Tavily or Listing page). Never fabricate. Only single-job or ATS URLs for this role. Omit if you only see search/collection pages.'
        ].join('\n')
      : '';

  const candidateUrlBlock = (function () {
    if (collection !== 'jobs-crm') return '';
    const urls = extractHttpUrls(ctx)
      .filter(function (u) {
        return !isLikelyBadJobListingUrl(u);
      })
      .slice(0, 15);
    if (!urls.length) {
      return '\n\n(No direct http(s) URLs extracted from context — you will likely need to omit `url` unless the listing text contains a plain URL you can repeat exactly.)';
    }
    return (
      '\n\nAllowed candidate URLs for the `url` field (copy one of these strings exactly, or omit `url`):\n' +
      urls.map(function (u, i) {
        return i + 1 + '. ' + u;
      }).join('\n')
    );
  })();

  const system = (function () {
    const parts = [
      isJobsCrmFullReconcile(collection)
        ? 'You reconcile a job-tracker row with web + listing text. Accuracy beats brevity for `notes`; other strings stay professional and factual.'
        : 'You help fill in portfolio CMS records using ONLY the provided context and widely known public facts.'
    ];

    if (collection === 'jobs-crm' && enhanceJobsJsonSchema) {
      parts.push(
        'Your reply is constrained by a JSON Schema (co, role, loc, notes, url, deadline, yoe, tags). Always include every field; use "" or [] for unknowns as instructed below—do not omit keys.'
      );
    } else {
      parts.push(
        'Return a single JSON object with keys ONLY from this list: ' + allowedKeysFor(collection).join(', ') + '.'
      );
      parts.push(
        isJobsCrmFullReconcile(collection)
          ? 'Include as many keys as you can justify from Context (see field instructions). Omit a key only if Context gives you nothing reliable for it.'
          : 'Omit keys you cannot support.'
      );
    }

    parts.push(
      'Rules:',
      '- Strings: concise, professional, suitable for a marketing portfolio or job tracker.',
      '- skills and tags: short phrases, 3–12 items max when filling empty lists.',
      '- Do not invent employer-specific metrics, awards, or confidential details.'
    );

    if (!(collection === 'jobs-crm' && enhanceJobsJsonSchema)) {
      parts.push(
        isJobsCrmFullReconcile(collection)
          ? '- If Context truly has no signal for a field, omit that key rather than guessing.'
          : '- If context is insufficient for a field, omit that key.'
      );
    }

    parts.push(jobsCrmExtra);
    parts.push('Output ONLY valid JSON, no markdown fences.');
    return parts.filter(Boolean).join('\n');
  })();

  const fieldInstruction = isJobsCrmFullReconcile(collection)
    ? 'Fields to reconcile (review ALL against Context; output corrected values for each key you can verify from the posting/snippets): '
    : 'Fields that may be filled (empty or placeholder): ';

  const user = [
    'Collection: ' + collection,
    'Current record (JSON):\n' + JSON.stringify(item, null, 2),
    fieldInstruction + targetFields.join(', '),
    '',
    'Context from web / listing (may be partial):\n' +
      (ctx || '(no external context — omit speculative fields)'),
    candidateUrlBlock
  ].join('\n');

  const raw = await completeJson(system, user, collection);
  const patchInput = collection === 'jobs-crm' ? stripEmptyJobCrmPatch(raw) : raw;
  const patch = sanitizePatch(patchInput, collection, targetFields, ctx);
  return { patch, missing: targetFields, skipped: Object.keys(patch).length === 0 };
}

async function enhanceItem(collection, id) {
  const file = DATA_FILES[collection];
  if (!file) throw new Error('Unknown collection');

  const data = loadData(file);
  const idx = data.findIndex(function (x) {
    return x.id === id;
  });
  if (idx === -1) throw new Error('Not found');

  const item = data[idx];
  const hadBadUrl = collection === 'jobs-crm' && jobUrlNeedsUpgrade(item.url);
  const webContext = await gatherWebContext(collection, item);
  const { patch, skipped } = await proposePatch(collection, item, webContext);

  if (skipped || Object.keys(patch).length === 0) {
    return {
      id,
      updated: [],
      message: skipped
        ? isJobsCrmFullReconcile(collection)
          ? 'No updates applied (model returned no changes from context).'
          : 'Nothing to fill; all tracked fields already look complete.'
        : 'No confident updates from context.'
    };
  }

  let merged = mergePatch(item, patch, collection);
  if (collection === 'jobs-crm' && patch.url === undefined && hadBadUrl) {
    merged = { ...merged };
    delete merged.url;
  }

  data[idx] = merged;
  saveData(file, data);

  let updatedKeys = Object.keys(patch);
  if (collection === 'jobs-crm' && patch.url === undefined && hadBadUrl && item.url && merged.url === undefined) {
    updatedKeys = updatedKeys.concat(['url']);
  }

  return {
    id,
    updated: updatedKeys,
    message: 'Saved.',
    patch
  };
}

async function enhanceAll(collection) {
  const file = DATA_FILES[collection];
  if (!file) throw new Error('Unknown collection');

  const data = loadData(file);
  const slice = data.slice(0, ENHANCE_ALL_LIMIT);
  const results = [];
  const errors = [];

  for (let i = 0; i < slice.length; i++) {
    const row = slice[i];
    try {
      const r = await enhanceItem(collection, row.id);
      results.push(r);
      await new Promise(function (resolve) {
        setTimeout(resolve, 350);
      });
    } catch (e) {
      errors.push({ id: row.id, error: e.message || String(e) });
    }
  }

  return {
    processed: slice.length,
    limit: ENHANCE_ALL_LIMIT,
    total: data.length,
    truncated: data.length > ENHANCE_ALL_LIMIT,
    results,
    errors
  };
}

function assertConfigured() {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error(
      'Configure ANTHROPIC_API_KEY or OPENAI_API_KEY on the server. Optional: TAVILY_API_KEY for web search.'
    );
  }
}

module.exports = {
  enhanceItem,
  enhanceAll,
  assertConfigured,
  ENHANCE_ALL_LIMIT,
  DATA_FILES
};
