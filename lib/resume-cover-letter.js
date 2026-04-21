/**
 * Generate a job-specific cover letter from resume + notes + posting (Markdown).
 */

const { completeChatLlm } = require('./llm-chat');
const { countLines, getMaxCoverLetterLines } = require('./resume-line-budget');

const SYSTEM = `You write concise, professional cover letters for job applications.
## Rules
- Use only facts grounded in the candidate's resume and profile notes below. Do not invent employers, titles, dates, degrees, or achievements.
- If the company name appears in the job posting, you may use it in the greeting; otherwise use "Hiring Manager" or "Dear Hiring Manager".
- 3–4 short paragraphs typical; professional, warm, confident — not generic filler.
- Align themes to the job description without keyword stuffing.
- Output ONLY the cover letter body in Markdown (paragraphs; optional **bold** for role title sparingly). No subject line, no "Cover letter" title unless it fits as a single H1 — prefer starting with the salutation.
- Stay within the line budget given in the task.`;

/**
 * @param {{
 *   resumeMarkdown: string,
 *   resumeNotes: string,
 *   jobDescription: string,
 *   additionalDetails?: string,
 *   provider: 'openai' | 'anthropic',
 *   model: string,
 *   maxLines: number
 * }} opts
 */
async function generateCoverLetter({
  resumeMarkdown,
  resumeNotes,
  jobDescription,
  additionalDetails,
  provider,
  model,
  maxLines
}) {
  if (!String(resumeMarkdown || '').trim()) {
    throw new Error('Resume is empty — upload your resume first.');
  }
  if (!String(jobDescription || '').trim()) {
    throw new Error('Job description is required.');
  }

  const parts = [
    '## Candidate resume (Markdown)\n\n' + String(resumeMarkdown).trim(),
    '## Job posting\n\n' + String(jobDescription).trim()
  ];

  if (String(resumeNotes || '').trim()) {
    parts.push('## Persistent profile notes\n\n' + String(resumeNotes).trim());
  }
  if (additionalDetails && String(additionalDetails).trim()) {
    parts.push('## Instructions for this application\n\n' + String(additionalDetails).trim());
  }

  parts.push(
    '## Task\n\nWrite the cover letter. Maximum ' +
      maxLines +
      ' lines total (count every line break, including blanks). Output ONLY the letter in Markdown.'
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
    maxTokens: 8000,
    temperature: 0.35,
    provider,
    reasoningEffort
  };
  if (provider === 'openai') {
    llmOpts.openaiModel = model;
  } else {
    llmOpts.anthropicModel = model;
  }

  const result = await completeChatLlm(llmOpts);
  const text = String(result.text || '').trim();
  if (!text) {
    throw new Error('The model returned empty text for the cover letter.');
  }
  if (countLines(text) > maxLines) {
    throw new Error(
      'Cover letter exceeds the line limit (' +
        maxLines +
        ' lines). Try a shorter job description, shorten profile notes, or raise MAX_COVER_LETTER_LINES.'
    );
  }
  return {
    coverLetterMarkdown: text,
    model: result.model,
    provider: result.provider
  };
}

module.exports = { generateCoverLetter };
