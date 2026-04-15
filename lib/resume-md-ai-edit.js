/**
 * Revise public resume Markdown using OpenAI from a natural-language instruction.
 */

const MAX_MD_CHARS = 96000;
const MAX_PROMPT_CHARS = 8000;

/**
 * @param {string} markdown — current resume.md body
 * @param {string} userPrompt — what to change (tone, length, emphasis, etc.)
 * @returns {Promise<string>} full revised Markdown only
 */
async function editResumeMarkdownWithPrompt(markdown, userPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const md = String(markdown || '').trimEnd();
  const prompt = String(userPrompt || '').trim();
  if (!prompt) {
    throw new Error('Prompt is required');
  }
  if (!md) {
    throw new Error('Resume Markdown is empty — upload a file or paste content and save first');
  }

  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

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

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 8192,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(raw.slice(0, 600) || `OpenAI API error ${res.status}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new Error('Invalid response from OpenAI API');
  }

  const content =
    data.choices &&
    data.choices[0] &&
    data.choices[0].message &&
    data.choices[0].message.content;
  if (!content || typeof content !== 'string') {
    throw new Error('Empty response from OpenAI');
  }

  let out = content.trim();
  if (out.startsWith('```')) {
    out = out.replace(/^```[a-z]*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  }
  return out;
}

module.exports = { editResumeMarkdownWithPrompt };
