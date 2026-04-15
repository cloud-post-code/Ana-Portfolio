/**
 * Revise public resume Markdown using OpenAI or Anthropic from a natural-language instruction.
 */

const { completeChatLlm } = require('./llm-chat');
const { DEFAULT_OPENAI_CHAT_MODEL } = require('./openai-defaults');

const MAX_MD_CHARS = 96000;
const MAX_PROMPT_CHARS = 8000;

/**
 * @param {string} markdown — current resume.md body
 * @param {string} userPrompt — what to change (tone, length, emphasis, etc.)
 * @returns {Promise<string>} full revised Markdown only
 */
async function editResumeMarkdownWithPrompt(markdown, userPrompt) {
  const md = String(markdown || '').trimEnd();
  const prompt = String(userPrompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  if (!md) {
    throw new Error('Resume Markdown is empty — upload a file or paste content and save first');
  }

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

  const r = await completeChatLlm({
    system,
    user,
    maxTokens: 8192,
    temperature: 0.2,
    openaiModel: process.env.OPENAI_MODEL || DEFAULT_OPENAI_CHAT_MODEL,
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
  });

  let out = r.text.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return out;
}

module.exports = { editResumeMarkdownWithPrompt };
