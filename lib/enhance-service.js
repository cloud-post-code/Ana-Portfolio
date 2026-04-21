/**
 * Web-assisted field enhancement: optional Tavily search, optional Jina URL read,
 * then Anthropic or OpenAI to propose JSON patches.
 * Fills empty or placeholder fields for experiences and projects only.
 */

const { dedupeTavilyResults } = require('./tavily-dedupe');
const { getCollection, saveCollection } = require('./cms-store');
const { anthropicMessageText } = require('./anthropic-text');
const { DEFAULT_OPENAI_CHAT_MODEL } = require('./openai-defaults');
const { buildChatCompletionsBody } = require('./openai-chat-body');
const { extractOpenAiAssistantText } = require('./openai-assistant-text');

const DATA_FILES = {
  experiences: 'experiences.json',
  projects: 'projects.json'
};

const ENHANCE_ALL_LIMIT = 20;

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

function fieldNeedsFill(key, val) {
  if (key === 'id' || key === 'slug' || key === 'logo' || key === 'deliverables' || key === 'order') {
    return false;
  }
  if (key === 'title') return isEmpty(val) || isPlaceholderText(val);
  if (key === 'skills') return isEmpty(val) || (Array.isArray(val) && val.every(s => !String(s).trim()));
  if (typeof val === 'string') {
    if (!val.trim()) return true;
    if (isPlaceholderText(val)) return true;
    if (key === 'description' && val.trim().length < 20) return true;
  }
  return isEmpty(val);
}

function allowedKeysFor() {
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

function listMissingFields(item) {
  const allowed = allowedKeysFor();
  const missing = [];
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(item, key)) {
      missing.push(key);
      continue;
    }
    if (fieldNeedsFill(key, item[key])) missing.push(key);
  }
  return missing;
}

function targetFieldsForEnhance(item) {
  return listMissingFields(item);
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
    return text.slice(0, 18000);
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

function buildSearchQuery(item) {
  return [item.title, item.company, item.type, item.role, 'marketing student portfolio'].filter(Boolean).join(' ');
}

async function gatherWebContext(item) {
  const parts = [];
  const q = buildSearchQuery(item);
  const tavily = await tavilySearch(q);
  if (tavily) parts.push('=== Web search (Tavily) ===\n' + tavily);
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

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openaiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(
        buildChatCompletionsBody({
          model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_CHAT_MODEL,
          maxTokens: 4096,
          temperature: 0.2,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      )
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error('OpenAI API error: ' + res.status + ' ' + errText.slice(0, 200));
    }
    const data = await res.json();
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    const text = extractOpenAiAssistantText(msg);
    return parseJsonFromLlm(text);
  }

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

  throw new Error(
    'Set OPENAI_API_KEY or ANTHROPIC_API_KEY in the server environment. Optional: TAVILY_API_KEY for broader web search.'
  );
}

async function completeJson(system, user) {
  return completeJsonLegacy(system, user);
}

function sanitizePatch(patch, targetFieldKeys) {
  const allowed = new Set(allowedKeysFor());
  const out = {};
  const allowedThisRun = new Set(targetFieldKeys);
  for (const key of Object.keys(patch || {})) {
    if (!allowed.has(key) || !allowedThisRun.has(key)) continue;
    const v = patch[key];
    if (key === 'skills') {
      if (!Array.isArray(v)) continue;
      out[key] = v.map(s => String(s).trim().slice(0, 120)).filter(Boolean).slice(0, 25);
    } else if (typeof v === 'string') {
      out[key] = v.trim().slice(0, 8000);
    }
  }
  return out;
}

function mergePatch(existing, patch) {
  const out = { ...existing };
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (key === 'skills') {
      const prev = Array.isArray(existing[key]) ? existing[key] : [];
      out[key] = [...new Set([...prev, ...val])].slice(0, 25);
    } else {
      out[key] = val;
    }
  }
  return out;
}

async function proposePatch(collection, item, webContext) {
  const targetFields = targetFieldsForEnhance(item);
  if (targetFields.length === 0) {
    return { patch: {}, missing: [], skipped: true };
  }

  const ctx = String(webContext || '');

  const system = [
    'You help fill in portfolio CMS records using ONLY the provided context and widely known public facts.',
    'Return a single JSON object with keys ONLY from this list: ' + allowedKeysFor().join(', ') + '.',
    'Omit keys you cannot support.',
    'Rules:',
    '- Strings: concise, professional, suitable for a marketing portfolio.',
    '- skills: short phrases, 3–12 items max when filling empty lists.',
    '- Do not invent employer-specific metrics, awards, or confidential details.',
    '- If context is insufficient for a field, omit that key.',
    'Output ONLY valid JSON, no markdown fences.'
  ].join('\n');

  const user = [
    'Collection: ' + collection,
    'Current record (JSON):\n' + JSON.stringify(item, null, 2),
    'Fields that may be filled (empty or placeholder): ' + targetFields.join(', '),
    '',
    'Context from web (may be partial):\n' + (ctx || '(no external context — omit speculative fields)')
  ].join('\n');

  const raw = await completeJson(system, user);
  const patch = sanitizePatch(raw, targetFields);
  return { patch, missing: targetFields, skipped: Object.keys(patch).length === 0 };
}

async function enhanceItem(collection, id) {
  if (!DATA_FILES[collection]) throw new Error('Unknown collection');

  const data = await getCollection(collection);
  const idx = data.findIndex(function (x) { return x.id === id; });
  if (idx === -1) throw new Error('Not found');

  const item = data[idx];
  const webContext = await gatherWebContext(item);
  const { patch, skipped } = await proposePatch(collection, item, webContext);

  if (skipped || Object.keys(patch).length === 0) {
    return {
      id,
      updated: [],
      message: skipped
        ? 'Nothing to fill; all tracked fields already look complete.'
        : 'No confident updates from context.'
    };
  }

  data[idx] = mergePatch(item, patch);
  await saveCollection(collection, data);

  return { id, updated: Object.keys(patch), message: 'Saved.', patch };
}

async function enhanceAll(collection) {
  if (!DATA_FILES[collection]) throw new Error('Unknown collection');

  const data = await getCollection(collection);
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
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Configure OPENAI_API_KEY or ANTHROPIC_API_KEY on the server. Optional: TAVILY_API_KEY for web search.'
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
