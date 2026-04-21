/**
 * Tailor resume markdown for a specific job using LLM.
 * Takes the existing resume markdown, a job description, and optional
 * additional details, and returns an adjusted version of the resume
 * in Markdown format.
 */

const { completeChatLlm } = require('./llm-chat');

const SYSTEM = `You are a senior executive resume writer and hiring strategist. Your job is to return ONE refined, improved, role-specific version of the candidate's resume—not a generic rewrite.

## What you deliver
A polished Markdown resume the candidate can export to Word: clear hierarchy, scannable bullets, confident professional tone, and language aligned to the target role and company context implied by the job description.

## Quality bar (non-negotiable)
- **Refinement:** Tighten phrasing; use strong action verbs and concrete outcomes where the source material supports them. Improve clarity and impact without changing meaning.
- **Truth:** Preserve every fact: employers, titles, dates, education, metrics, tools, and scope. Never invent employers, degrees, dates, numbers, or responsibilities. If a metric is missing, do not fabricate one—rephrase for clarity only.
- **Fit:** Mirror priority themes, skills, and terminology from the job description naturally (ATS-friendly), without keyword stuffing or awkward repetition.
- **Structure:** Keep Markdown headings and bullet lists. Prefer the same section order unless reordering clearly improves relevance for this role (e.g. most relevant experience first).
- **Tone:** Professional, concise, human—avoid buzzword soup and vague claims ("results-driven") unless tied to a specific outcome already in the resume.
- **Length:** Aim for one strong page equivalent unless the user's notes ask otherwise; trim redundancy, not substance.

## Output contract
Return ONLY the full tailored resume in Markdown. No title line, no preamble, no "Here is your resume", no closing remarks, no \`\`\` fences around the whole document.`;

/**
 * @param {{ resumeMarkdown: string, jobDescription: string, additionalDetails?: string }} opts
 * @returns {Promise<{ tailoredMarkdown: string, model: string, provider: string }>}
 */
async function tailorResumeForJob({ resumeMarkdown, jobDescription, additionalDetails }) {
  if (!String(resumeMarkdown || '').trim()) {
    throw new Error('Resume is empty — upload or write your resume first.');
  }
  if (!String(jobDescription || '').trim()) {
    throw new Error('Job description is required.');
  }

  const parts = [
    '## Current Resume\n\n' + resumeMarkdown.trim(),
    '## Job Description\n\n' + jobDescription.trim()
  ];

  if (additionalDetails && String(additionalDetails).trim()) {
    parts.push('## Additional notes from the applicant\n\n' + additionalDetails.trim());
  }

  parts.push(
    '## Task\n\nProduce a refined, improved, fully tailored Markdown resume for this job—ready to save as a Word document. Follow the system instructions exactly. Output ONLY the complete resume in Markdown.'
  );

  const result = await completeChatLlm({
    system: SYSTEM,
    user: parts.join('\n\n'),
    maxTokens: 16000,
    temperature: 0.3
  });

  const tailoredMarkdown = String(result.text || '').trim();
  if (!tailoredMarkdown) {
    throw new Error('The model returned empty text — try again or shorten the input.');
  }

  return {
    tailoredMarkdown,
    model: result.model,
    provider: result.provider
  };
}

module.exports = { tailorResumeForJob };
