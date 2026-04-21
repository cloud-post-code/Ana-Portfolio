/**
 * Tailor resume markdown for a specific job using LLM.
 * Takes the existing resume markdown, a job description, and optional
 * additional details, and returns an adjusted version of the resume
 * in Markdown format.
 */

const { completeChatLlm } = require('./llm-chat');

const SYSTEM = `You are an expert resume writer and career coach.
The user will provide their current resume in Markdown format, a job description, and optionally some additional notes.
Your task is to rewrite the resume so it is strongly tailored to that specific role.

Rules:
- Preserve ALL factual information (employer names, dates, degrees, actual accomplishments). Do not invent or remove facts.
- Reorder bullet points to lead with the most relevant experience for this role.
- Adjust wording of bullets and the summary/objective to echo the language and priorities in the job description — but keep claims honest.
- Use the job description keywords naturally throughout (for ATS matching).
- Keep the same Markdown structure (headings, bullet lists). Do NOT change to a different format.
- Keep the output concise and professional. Remove any content that is clearly irrelevant to this role if there is enough relevant content to fill the page.
- If the user provided additional notes, honour those constraints first (e.g. length targets, specific sections to emphasise).
- Output ONLY the adjusted resume in Markdown — no preamble, no commentary, no fences.`;

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
    '## Task\n\nRewrite the resume above so it is tailored to this role. Output ONLY the adjusted Markdown resume.'
  );

  const result = await completeChatLlm({
    system: SYSTEM,
    user: parts.join('\n\n'),
    maxTokens: 4096,
    temperature: 0.3
  });

  return {
    tailoredMarkdown: result.text,
    model: result.model,
    provider: result.provider
  };
}

module.exports = { tailorResumeForJob };
