/**
 * Extract user-visible text from Anthropic Messages API `content` array.
 * Handles multiple blocks (e.g. thinking + text) so we do not read only content[0].
 */
function anthropicMessageText(data) {
  const blocks = data && data.content;
  if (!Array.isArray(blocks)) return '';
  const parts = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b || b.type !== 'text' || typeof b.text !== 'string') continue;
    parts.push(b.text);
  }
  let out = parts.join('\n');
  // Legacy: single block with `text` but no `type` (treat as assistant text)
  if (!out && blocks[0] && typeof blocks[0].text === 'string' && blocks[0].type == null) {
    out = blocks[0].text;
  }
  return out;
}

module.exports = { anthropicMessageText };
