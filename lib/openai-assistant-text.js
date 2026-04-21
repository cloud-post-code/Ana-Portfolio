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
      if (typeof p === 'object' && p !== null) {
        const o = /** @type {{ text?: unknown; type?: unknown }} */ (p);
        if (typeof o.text === 'string') {
          parts.push(o.text);
          continue;
        }
        // Some responses nest text (e.g. reasoning summaries); shallow scan only
        const nested = o.content;
        if (Array.isArray(nested)) {
          for (let j = 0; j < nested.length; j++) {
            const q = nested[j];
            if (q && typeof q === 'object' && typeof /** @type {{ text?: string }} */ (q).text === 'string') {
              parts.push(q.text);
            }
          }
        }
      }
    }
    return parts.join('');
  }
  if (typeof c === 'object' && c !== null && typeof /** @type {{ text?: string }} */ (c).text === 'string') {
    return /** @type {{ text: string }} */ (c).text;
  }
  return '';
}

module.exports = { extractOpenAiAssistantText };
