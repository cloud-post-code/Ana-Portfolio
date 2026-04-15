/**
 * Revise public resume Markdown using Claude from a natural-language instruction.
 */

const { anthropicMessageText } = require('./anthropic-text');

const MAX_MD_CHARS = 96000;
const MAX_PROMPT_CHARS = 8000;

/**
 * @param {string} markdown — current resume.md body
 * @param {string} userPrompt — what to change (tone, length, emphasis, etc.)
 * @returns {Promise<string>} full revised Markdown only
 */
async function editResumeMarkdownWithPrompt(markdown, userPrompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const md = String(markdown || '').trimEnd();
  const prompt = String(userPrompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  if (!md) {
    throw new Error('Resume Markdown is empty — upload a file or paste content and save first');
  }

  const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  const system =
    'You revise a resume written in Markdown. Apply ONLY what the user asks. ' +
    'Keep headings and structure unless they ask to change them. ' +
    'Preserve factual content (names, dates, employers, degrees) unless the user explicitly asks to change or remove it—do not invent employers, titles, degrees, or metrics. ' +
    'Output ONLY the full revised Markdown document. No preamble, no explanation, no markdown code fences wrapping the whole file.';

  const user =
    'Current resume (Markdown):\n\n' +
    md.slice(0, MAX_MD_CHARS) +
    '\n\n---\nUser instruction:\n' +
    prompt.slice(0, MAX_PROMPT_CHARS);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: user }]
    })
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw.slice(0, 600) || `Anthropic API error ${res.status}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('Invalid response from Anthropic API');
  }

  let out = anthropicMessageText(data).trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return out;
}

module.exports = { editResumeMarkdownWithPrompt };
