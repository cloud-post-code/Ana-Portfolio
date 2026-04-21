/**
 * Shared chat completion: prefers OPENAI_API_KEY (ChatGPT API), else ANTHROPIC_API_KEY (Claude).
 */

const { anthropicMessageText } = require('./anthropic-text');
const { DEFAULT_OPENAI_CHAT_MODEL } = require('./openai-defaults');
const { buildChatCompletionsBody } = require('./openai-chat-body');
const { extractOpenAiAssistantText } = require('./openai-assistant-text');

/**
 * @param {{
 *   system: string,
 *   user: string,
 *   maxTokens?: number,
 *   temperature?: number,
 *   openaiModel?: string,
 *   anthropicModel?: string,
 *   reasoningEffort?: string | false
 * }} opts
 * @returns {Promise<{ text: string, provider: 'openai' | 'anthropic', model: string }>}
 */
async function completeChatLlm(opts) {
  const system = String(opts.system || '');
  const user = String(opts.user || '');
  const temperature = opts.temperature != null ? Number(opts.temperature) : 0.2;
  const mt =
    opts.maxTokens != null && Number(opts.maxTokens) > 0
      ? Math.min(Number(opts.maxTokens), 16384)
      : 8000;

  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (openaiKey) {
    const model = opts.openaiModel || process.env.OPENAI_MODEL || DEFAULT_OPENAI_CHAT_MODEL;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + openaiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(
        buildChatCompletionsBody({
          model,
          maxTokens: mt,
          temperature,
          reasoningEffort: opts.reasoningEffort,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user }
          ]
        })
      )
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error('OpenAI API error ' + res.status + ': ' + raw.slice(0, 400));
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error('Invalid JSON from OpenAI API');
    }
    const message = data.choices && data.choices[0] && data.choices[0].message;
    const text = String(extractOpenAiAssistantText(message) || '').trim();
    if (!text) {
      const choice = data.choices && data.choices[0];
      const fr = choice && choice.finish_reason;
      const usage = data.usage;
      let detail = '';
      if (fr) detail += ' finish_reason=' + String(fr);
      if (usage) {
        try {
          detail += ' usage=' + JSON.stringify(usage).slice(0, 500);
        } catch (e) {
          /* ignore */
        }
      }
      let hint = '';
      if (String(model).toLowerCase().includes('gpt-5') || /^o[34]/i.test(String(model))) {
        hint =
          ' If this repeats, set OPENAI_REASONING_EFFORT=low (or minimal) on the server, or raise max output tokens.';
      }
      throw new Error('Empty response from OpenAI.' + (detail ? ' Details:' + detail : '') + hint);
    }
    return { text, provider: 'openai', model };
  }

  if (anthropicKey) {
    const model =
      opts.anthropicModel ||
      process.env.ANTHROPIC_MODEL ||
      'claude-haiku-4-5';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: mt,
        temperature,
        system,
        messages: [{ role: 'user', content: user }]
      })
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error('Anthropic API error ' + res.status + ': ' + raw.slice(0, 400));
    }
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      throw new Error('Invalid JSON from Anthropic API');
    }
    const text = anthropicMessageText(data).trim();
    if (!text) {
      throw new Error('Empty response from Anthropic');
    }
    return { text, provider: 'anthropic', model };
  }

  throw new Error(
    'Set OPENAI_API_KEY or ANTHROPIC_API_KEY in the server environment.'
  );
}

module.exports = { completeChatLlm };
