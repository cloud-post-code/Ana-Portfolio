/**
 * Build OpenAI Chat Completions request bodies compatible with GPT-5 family models.
 * GPT-5 models reject `temperature` and use `max_completion_tokens` instead of `max_tokens`.
 */

/**
 * @param {string} model
 * @returns {boolean}
 */
function isGpt5FamilyModel(model) {
  const m = String(model || '').toLowerCase();
  return m.includes('gpt-5') || /^o[34]/.test(m);
}

/**
 * @param {{
 *   model: string,
 *   messages: Array<{ role: string, content: string }>,
 *   maxTokens: number,
 *   temperature?: number,
 *   response_format?: object,
 *   reasoningEffort?: string | false
 * }} opts
 * @returns {Record<string, unknown>}
 */
function buildChatCompletionsBody(opts) {
  const model = String(opts.model || '');
  const cap = Number(opts.maxTokens) > 0 ? Math.min(Number(opts.maxTokens), 16384) : 8000;
  const body = {
    model,
    messages: opts.messages
  };

  if (isGpt5FamilyModel(model)) {
    body.max_completion_tokens = cap;
    function applyReasoningEffort(value) {
      if (value == null || value === false || String(value).trim() === '') return;
      const effort = String(value).trim();
      const off = effort.toLowerCase();
      if (off === 'off' || off === 'false' || off === '0' || off === 'default') return;
      body.reasoning_effort = effort;
    }
    // Per-request wins (e.g. resume tailor defaults to low); else global OPENAI_REASONING_EFFORT.
    // reasoningEffort: false = caller disables (do not fall back to env).
    if (opts.reasoningEffort === false) {
      /* omit reasoning_effort entirely */
    } else {
      applyReasoningEffort(opts.reasoningEffort);
      if (!body.reasoning_effort) {
        applyReasoningEffort(process.env.OPENAI_REASONING_EFFORT);
      }
    }
  } else {
    body.max_tokens = cap;
    body.temperature = opts.temperature != null ? Number(opts.temperature) : 0.2;
  }

  if (opts.response_format) {
    body.response_format = opts.response_format;
  }

  return body;
}

module.exports = {
  isGpt5FamilyModel,
  buildChatCompletionsBody
};
