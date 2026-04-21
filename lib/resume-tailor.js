/**
 * Tailor resume markdown for a specific job using LLM.
 * Takes the existing resume markdown, a job description, optional persistent
 * profile notes, optional per-job instructions, and returns an adjusted resume in Markdown.
 */

const { completeChatLlm } = require('./llm-chat');
const { countLines } = require('./resume-line-budget');

const SYSTEM = `You are a senior executive resume writer. Your job is to return ONE job-specific version of the candidate's resume in Markdown.

## Focus
- **Tailoring:** Reorder sections or bullets so the most relevant experience leads. **Rewrite bullets** to echo the job description's priorities and keywords (ATS-friendly), without stuffing or awkward repetition.
- **Facts:** Preserve every fact from the resume and persistent profile notes: employers, titles, dates, education, metrics, tools, scope. Never invent or remove facts.
- **Structure:** Keep Markdown headings and bullet lists. Change bullet wording and order for fit; keep the same overall document structure unless reordering clearly helps this role.
- **Tone:** Professional, concise, human.
- **Length:** The final Markdown MUST have at most the line budget given in the task (count every line including blanks). If tight, trim redundancy and less relevant bullets—never sacrifice truth.

## Output
Return ONLY the full tailored resume in Markdown. No preamble, no "Here is your resume", no closing remarks, no code fences wrapping the whole document.`;

/**
 * @param {{
 *   resumeMarkdown: string,
 *   resumeNotes?: string,
 *   jobDescription: string,
 *   additionalDetails?: string,
 *   provider: 'openai' | 'anthropic',
 *   model: string,
 *   maxOutputLines: number
 * }} opts
 * @returns {Promise<{ tailoredMarkdown: string, model: string, provider: string }>}
 */
async function tailorResumeForJob({
  resumeMarkdown,
  resumeNotes,
  jobDescription,
  additionalDetails,
  provider,
  model,
  maxOutputLines
}) {
  if (!String(resumeMarkdown || '').trim()) {
    throw new Error('Resume is empty — upload or write your resume first.');
  }
  if (!String(jobDescription || '').trim()) {
    throw new Error('Job description is required.');
  }

  const parts = ['## Current Resume\n\n' + resumeMarkdown.trim()];

  if (resumeNotes && String(resumeNotes).trim()) {
    parts.push('## Persistent profile notes\n\n' + String(resumeNotes).trim());
  }

  parts.push('## Job description\n\n' + jobDescription.trim());

  if (additionalDetails && String(additionalDetails).trim()) {
    parts.push('## Instructions for this job (optional)\n\n' + additionalDetails.trim());
  }

  parts.push(
    '## Task\n\nTailor the resume for this job: rewrite and reorder bullets for fit, align language to the posting, keep all facts. The complete Markdown output must be at most ' +
      maxOutputLines +
      ' lines (counting every line break). Output ONLY the full resume in Markdown.'
  );

  let reasoningEffort = 'low';
  const rre = process.env.OPENAI_RESUME_REASONING_EFFORT;
  if (provider === 'anthropic') {
    reasoningEffort = false;
  } else if (rre != null) {
    const s = String(rre).trim().toLowerCase();
    if (s === '' || s === 'off' || s === 'false' || s === '0') {
      reasoningEffort = false;
    } else {
      reasoningEffort = String(rre).trim();
    }
  }

  const llmOpts = {
    system: SYSTEM,
    user: parts.join('\n\n'),
    maxTokens: 16000,
    temperature: 0.3,
    provider,
    reasoningEffort
  };
  if (provider === 'openai') {
    llmOpts.openaiModel = model;
  } else {
    llmOpts.anthropicModel = model;
  }

  const result = await completeChatLlm(llmOpts);

  const tailoredMarkdown = String(result.text || '').trim();
  if (!tailoredMarkdown) {
    throw new Error('The model returned empty text — try again or shorten the input.');
  }
  if (countLines(tailoredMarkdown) > maxOutputLines) {
    throw new Error(
      'Tailored resume exceeds the line limit (' +
        maxOutputLines +
        ' lines). Try shortening the source resume or raise MAX_RESUME_PAGE_LINES.'
    );
  }

  return {
    tailoredMarkdown,
    model: result.model,
    provider: result.provider
  };
}

module.exports = { tailorResumeForJob };
