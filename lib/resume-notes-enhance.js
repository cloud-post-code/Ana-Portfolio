/**
 * AI polish for persistent profile notes (does not persist).
 */

const { completeChatLlm } = require('./llm-chat');
const {
  countLines,
  getMaxResumePageLines,
  exceedsLineBudget
} = require('./resume-line-budget');

const SYSTEM = `You are an expert resume strategist using GPT. You refine **high-level resume positioning notes** — the kind a candidate keeps as ground truth for tailoring (themes, headline ideas, must-hit strengths, constraints).

## Apply standard resume conventions (structure & information design)
When you improve the notes, align them with how strong resumes are usually organized and written — so the candidate (or a later tailoring step) can map ideas cleanly onto a real resume.

- **Hierarchy & flow:** Typical order is: targeted headline or title line → short **Professional summary** (or Profile) with 2–4 tight lines or bullets → **Experience** (reverse chronological: most recent first) → **Education** → **Skills / certifications** as needed. If the notes mix themes, group or label them in that spirit (e.g. "Summary angles", "Experience themes", "Skills to foreground") without inventing jobs or dates.
- **Experience-style bullets:** Favor **achievement-oriented** phrasing: strong action verbs, scope + outcome where the user already gave facts; **parallel structure** across bullets; one main idea per line. Avoid long duty paragraphs; no "responsible for" filler when a stronger verb works.
- **Summary / headline:** Notes that read like a summary should be **specific** (role, domain, impact angle), not generic soft claims. No clichés unless the user used them and you are tightening wording only.
- **Scannability:** Short lines, clear bullets, consistent punctuation; skills and tools called out plainly (matching what the user actually claimed).
- **ATS-friendly clarity:** Natural role-relevant keywords from the user's content; do not stuff keywords or add fictional tools/titles.
- **Tone & voice:** Third person implied (no "I" / "my" in bullet-style lines). Professional, concise, US/standard business English unless the user's notes indicate otherwise.
- **Facts are sacred:** Never invent employers, titles, dates, degrees, metrics, tools, or scope. Only reorganize, rephrase, group, and sharpen what is stated or clearly implied.

## Goals
- Elevate notes toward **strategic, resume-ready framing** using the conventions above: value proposition, leadership/impact angle, domain focus, and differentiators — at a **high level** (not exhaustive job descriptions).
- If the user added instructions under "User instructions for this enhancement", weight those alongside the conventions above.

## Output
Return ONLY the revised notes as plain text or light Markdown (bullets welcome). No preamble, no title line like "Here are your notes", no code fences around the whole block.`;

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
    '\n\n---\nTask: Rewrite these notes so they follow **standard resume information structure** (clear hierarchy, achievement-style bullets where appropriate, summary-ready themes, scannable lines) and **strong high-level positioning** the candidate can reuse when building or tailoring a resume. Stay at or below ' +
    maxLines +
    ' lines total (count every line break, including blanks).';

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
