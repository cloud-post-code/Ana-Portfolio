/**
 * Normalize Chat Completions assistant `message.content`.
 * Newer models may return an array of content parts ({ type, text }) instead of a plain string.
 */

/**
 * @param {Record<string, unknown> | null | undefined} message
 * @returns {string}
 */
function extractOpenAiAssistantText(message) {
  if (!message || typeof message !== 'object') return '';
  const refusal = message.refusal;
  if (refusal != null && refusal !== '') {
    throw new Error('OpenAI refused the request: ' + String(refusal));
  }
  const c = message.content;
  if (c == null) return '';
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    const parts = [];
    for (let i = 0; i < c.length; i++) {
      const p = c[i];
      if (p == null) continue;
      if (typeof p === 'string') {
        parts.push(p);
        continue;
      }
      if (typeof p === 'object' && p !== null && typeof /** @type {{ text?: string }} */ (p).text === 'string') {
        parts.push(/** @type {{ text: string }} */ (p).text);
      }
    }
    return parts.join('');
  }
  return '';
}

module.exports = { extractOpenAiAssistantText };
