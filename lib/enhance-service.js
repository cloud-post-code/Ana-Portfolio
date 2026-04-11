/**
 * Web-assisted field enhancement: optional Tavily search, optional Jina URL read,
 * then Anthropic or OpenAI to propose JSON patches (fills only empty / placeholder fields).
 */

const fs = require('fs');
const path = require('path');

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

function fieldNeedsFill(key, val, collection) {
  if (key === 'id' || key === 'slug' || key === 'logo' || key === 'deliverables' || key === 'order') {
    return false;
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
        search_depth: 'basic',
        max_results: 6
      })
    });
    if (!res.ok) return '';
    const data = await res.json();
    return (data.results || [])
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
    const page = await fetchUrlAsMarkdown(item.url);
    if (page) parts.push('=== Listing page (read via URL) ===\n' + page);
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

async function completeJson(system, user) {
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
        model: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        system: system,
        messages: [{ role: 'user', content: user }]
      })
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('Anthropic API error: ' + res.status + ' ' + errText.slice(0, 200));
    }
    const data = await res.json();
    const text = data.content && data.content[0] && data.content[0].text;
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

function sanitizePatch(patch, collection, missingFields) {
  const allowed = new Set(allowedKeysFor(collection));
  const out = {};
  const mf = new Set(missingFields);
  for (const key of Object.keys(patch || {})) {
    if (!allowed.has(key) || !mf.has(key)) continue;
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
      out[key] = v.trim().slice(0, 8000);
    } else {
      continue;
    }
  }
  return out;
}

function mergePatch(existing, patch, collection) {
  const out = { ...existing };
  const missing = listMissingFields(existing, collection);
  const mf = new Set(missing);
  for (const key of Object.keys(patch)) {
    if (!mf.has(key)) continue;
    const val = patch[key];
    if (key === 'skills' || key === 'tags') {
      const prev = Array.isArray(existing[key]) ? existing[key] : [];
      const merged = [...new Set([...prev, ...val])].slice(0, 25);
      out[key] = merged;
    } else {
      out[key] = val;
    }
  }
  return out;
}

async function proposePatch(collection, item, webContext) {
  const missing = listMissingFields(item, collection);
  if (missing.length === 0) {
    return { patch: {}, missing: [], skipped: true };
  }

  const system = [
    'You help fill in portfolio CMS records using ONLY the provided context and widely known public facts.',
    'Return a single JSON object with keys ONLY from this list (omit keys you cannot support): ' +
      allowedKeysFor(collection).join(', '),
    'Rules:',
    '- Strings: concise, professional, suitable for a marketing portfolio or job tracker.',
    '- skills and tags: short phrases, 3–12 items max when filling empty lists.',
    '- Do not invent employer-specific metrics, awards, or confidential details.',
    '- If context is insufficient for a field, omit that key.',
    '- For jobs-crm url: only suggest if current url is empty and you have a direct career page URL from context.',
    'Output ONLY valid JSON, no markdown fences.'
  ].join('\n');

  const user = [
    'Collection: ' + collection,
    'Current record (JSON):\n' + JSON.stringify(item, null, 2),
    'Fields that may be filled (empty or placeholder): ' + missing.join(', '),
    '',
    'Context from web / listing (may be partial):\n' + (webContext || '(no external context — use conservative general phrasing only where appropriate)')
  ].join('\n');

  const raw = await completeJson(system, user);
  const patch = sanitizePatch(raw, collection, missing);
  return { patch, missing, skipped: Object.keys(patch).length === 0 };
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
  const webContext = await gatherWebContext(collection, item);
  const { patch, missing, skipped } = await proposePatch(collection, item, webContext);

  if (skipped || Object.keys(patch).length === 0) {
    return {
      id,
      updated: [],
      message: skipped ? 'Nothing to fill; all tracked fields already look complete.' : 'No confident updates from context.'
    };
  }

  const merged = mergePatch(item, patch, collection);
  data[idx] = merged;
  saveData(file, data);

  return {
    id,
    updated: Object.keys(patch),
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
