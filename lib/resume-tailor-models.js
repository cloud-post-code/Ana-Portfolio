/**
 * Allowed models for /admin/resume tailoring (server-validated; client cannot send arbitrary IDs).
 */

const { DEFAULT_OPENAI_CHAT_MODEL } = require('./openai-defaults');

/** @type {{ id: string, label: string }[]} */
const OPENAI_RESUME_MODELS = [
  { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
  { id: 'gpt-4o', label: 'GPT-4o' },
  { id: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { id: 'gpt-4.1', label: 'GPT-4.1' },
  { id: 'o4-mini', label: 'o4-mini' }
];

/** @type {{ id: string, label: string }[]} */
const ANTHROPIC_RESUME_MODELS = [
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
  { id: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' }
];

const OPENAI_IDS = new Set(OPENAI_RESUME_MODELS.map((m) => m.id));
const ANTHROPIC_IDS = new Set(ANTHROPIC_RESUME_MODELS.map((m) => m.id));

/**
 * Options for the admin UI (label includes provider).
 * @returns {{ provider: 'openai' | 'anthropic', model: string, label: string, value: string }[]}
 */
function getResumeTailorModelOptions() {
  const out = [];
  if (process.env.OPENAI_API_KEY) {
    for (const m of OPENAI_RESUME_MODELS) {
      out.push({
        provider: 'openai',
        model: m.id,
        label: 'OpenAI · ' + m.label,
        value: 'openai|' + m.id
      });
    }
  }
  if (process.env.ANTHROPIC_API_KEY) {
    for (const m of ANTHROPIC_RESUME_MODELS) {
      out.push({
        provider: 'anthropic',
        model: m.id,
        label: 'Anthropic · ' + m.label,
        value: 'anthropic|' + m.id
      });
    }
  }
  return out;
}

/**
 * Default selection for the dropdown (respects OPENAI_MODEL / ANTHROPIC_MODEL when valid).
 * @returns {{ provider: 'openai' | 'anthropic', model: string, value: string } | null}
 */
function getResumeTailorDefaultSelection() {
  const opts = getResumeTailorModelOptions();
  if (opts.length === 0) return null;

  const openaiKey = !!process.env.OPENAI_API_KEY;
  const antKey = !!process.env.ANTHROPIC_API_KEY;

  if (openaiKey) {
    const envM = String(process.env.OPENAI_MODEL || '').trim();
    if (envM && OPENAI_IDS.has(envM)) {
      const hit = opts.find((o) => o.provider === 'openai' && o.model === envM);
      if (hit) return { provider: 'openai', model: hit.model, value: hit.value };
    }
    const def = opts.find((o) => o.provider === 'openai' && o.model === DEFAULT_OPENAI_CHAT_MODEL);
    if (def) return { provider: 'openai', model: def.model, value: def.value };
    const firstOa = opts.find((o) => o.provider === 'openai');
    if (firstOa) return { provider: 'openai', model: firstOa.model, value: firstOa.value };
  }

  if (antKey) {
    const envM = String(process.env.ANTHROPIC_MODEL || '').trim();
    if (envM && ANTHROPIC_IDS.has(envM)) {
      const hit = opts.find((o) => o.provider === 'anthropic' && o.model === envM);
      if (hit) return { provider: 'anthropic', model: hit.model, value: hit.value };
    }
    const firstAnt = opts.find((o) => o.provider === 'anthropic');
    if (firstAnt) return { provider: 'anthropic', model: firstAnt.model, value: firstAnt.value };
  }

  return { provider: opts[0].provider, model: opts[0].model, value: opts[0].value };
}

/**
 * @param {{ provider?: string, model?: string } | null | undefined} body
 * @returns {{ provider: 'openai' | 'anthropic', model: string }}
 */
function resolveResumeTailorRequest(body) {
  const b = body || {};
  let provider = String(b.provider || '').trim().toLowerCase();
  let model = String(b.model || '').trim();

  const openaiKey = !!process.env.OPENAI_API_KEY;
  const antKey = !!process.env.ANTHROPIC_API_KEY;

  if (!openaiKey && !antKey) {
    throw new Error('No LLM API key configured on the server.');
  }

  if (!provider || provider === 'auto') {
    if (openaiKey) provider = 'openai';
    else provider = 'anthropic';
  }

  if (provider !== 'openai' && provider !== 'anthropic') {
    throw new Error('Invalid provider — use openai or anthropic.');
  }
  if (provider === 'openai' && !openaiKey) {
    throw new Error('OpenAI is not configured (OPENAI_API_KEY).');
  }
  if (provider === 'anthropic' && !antKey) {
    throw new Error('Anthropic is not configured (ANTHROPIC_API_KEY).');
  }

  if (!model) {
    if (provider === 'openai') {
      model = OPENAI_IDS.has(String(process.env.OPENAI_MODEL || '').trim())
        ? String(process.env.OPENAI_MODEL).trim()
        : DEFAULT_OPENAI_CHAT_MODEL;
    } else {
      model = ANTHROPIC_IDS.has(String(process.env.ANTHROPIC_MODEL || '').trim())
        ? String(process.env.ANTHROPIC_MODEL).trim()
        : 'claude-haiku-4-5';
    }
  }

  if (provider === 'openai' && !OPENAI_IDS.has(model)) {
    throw new Error('That OpenAI model is not allowed for resume tailoring.');
  }
  if (provider === 'anthropic' && !ANTHROPIC_IDS.has(model)) {
    throw new Error('That Anthropic model is not allowed for resume tailoring.');
  }

  return { provider, model };
}

module.exports = {
  getResumeTailorModelOptions,
  getResumeTailorDefaultSelection,
  resolveResumeTailorRequest
};
