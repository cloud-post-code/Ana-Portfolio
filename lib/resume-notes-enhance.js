/**
 * AI polish for persistent profile notes (does not persist).
 */

const { completeChatLlm } = require('./llm-chat');
const {
  countLines,
  getMaxResumePageLines,
  exceedsLineBudget
} = require('./resume-line-budget');

const SYSTEM = `You improve short career / positioning notes for a job seeker.
- Keep the same intent and facts; do not invent employers, titles, degrees, or metrics.
- Improve clarity, structure, and professional tone.
- If the user provided extra instructions, prioritize them alongside the default goals (e.g. tone, emphasis, format).
- Output ONLY the revised notes as plain text or light Markdown (short bullets allowed). No preamble or quotes around the whole text.`;

/**
 * @param {{ text: string, instructions?: string, provider: 'openai' | 'anthropic', model: string }} opts
 * @returns {Promise<string>}
 */
async function enhanceResumeNotes({ text, instructions, provider, model }) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('Nothing to enhance — add some text first.');
  }

  const maxLines = getMaxResumePageLines();
  if (exceedsLineBudget(raw, maxLines)) {
    throw new Error('Notes exceed the maximum line count — shorten before enhancing.');
  }

  const hint = String(instructions || '').trim();
  let user =
    '## Current notes\n\n' +
    raw +
    (hint
      ? '\n\n## User instructions for this enhancement\n\n' + hint
      : '') +
    '\n\n---\nTask: Polish these notes for clarity and impact. Stay at or below ' +
    maxLines +
    ' lines total (counting line breaks).';

  const llmOpts = {
    system: SYSTEM,
    user,
    maxTokens: 8192,
    temperature: 0.25,
    provider,
    reasoningEffort: provider === 'anthropic' ? false : 'low'
  };
  if (provider === 'openai') {
    llmOpts.openaiModel = model;
  } else {
    llmOpts.anthropicModel = model;
  }

  const result = await completeChatLlm(llmOpts);
  const out = String(result.text || '').trim();
  if (!out) {
    throw new Error('Enhancement returned empty text.');
  }
  if (exceedsLineBudget(out, maxLines)) {
    throw new Error('Enhanced text still exceeds the line limit — try shortening the source or raise MAX_RESUME_PAGE_LINES.');
  }
  return out;
}

module.exports = { enhanceResumeNotes };
