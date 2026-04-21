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
 *   response_format?: object
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
    // Leave room for visible output: reasoning models count internal "thinking" toward the same cap.
    const effort = String(process.env.OPENAI_REASONING_EFFORT || 'low').trim() || 'low';
    body.reasoning_effort = effort;
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
