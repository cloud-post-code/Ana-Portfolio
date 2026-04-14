/**
 * Map extracted resume plain text to job-search-profile JSON via Claude.
 * Text may come from PDF or Word (.docx); see resume-ingest-text.js.
 */

const { anthropicMessageText } = require('./anthropic-text');
const { extractPdfText, extractResumeDocumentText } = require('./resume-ingest-text');

const SCHEMA_INSTRUCTIONS = [
  'Return ONE JSON object. Include EVERY key below exactly once. Use "" for missing strings and [] for missing arrays—never omit a key.',
  '',
  '{',
  '  "applicant": {',
  '    "fullName": "from resume header or top of page",',
  '    "email": "mailto if present",',
  '    "phone": "as written",',
  '    "cityState": "city/state or region from header or top contact line",',
  '    "linkedIn": "full https URL if present; else empty string",',
  '    "portfolio": "personal site, GitHub, or portfolio URL if present; else empty string"',
  '  },',
  '  "headline": "One line: target role or branding line under the name, OR current/most recent job title + domain (e.g. Marketing Coordinator | Brand & Campaigns). If none, derive from the most recent role title only.",',
  '  "summary": "Professional summary, objective, or profile paragraph verbatim or lightly tightened. If the resume has NO summary section, write 2–4 sentences synthesizing scope and strengths using ONLY facts from the roles, education, and skills shown (no invented employers or metrics).",',
  '  "keyDetails": [ string, ... ] — up to 12 concise bullets: achievements, scope, industries, themes from experience and education. Prefer quantified lines when stated; otherwise outcome-focused paraphrase without inventing numbers.',
  '  "targetSkillsToUse": [ string, ... ] — 15–40 distinct skills: dedicated Skills section plus tools and capabilities from job bullets; split compounds; dedupe case-insensitively.',
  '  "locationsPreferred": [ string, ... ] — every distinct city/region from contact line, role headers, or education (e.g. Boston MA; Remote); dedupe.',
  '  "roleTypesPreferred": [ string, ... ] — up to 10 job titles from role headings; dedupe.',
  '  "education": [ { degree, dates, institution, location, bullets } ] — one object per school/degree/cert/bootcamp; bullets = honors GPA coursework activities as one newline-separated string or "".',
  '  "skillsGroups": {',
  '    "technical": "Tools, software, stacks, methods, analytics, design tools, coding languages—comma/semicolon separated from the Skills section and bullets.",',
  '    "professional": "Leadership, communication, strategy, stakeholder mgmt, project mgmt, analysis, presentation—only if stated or clearly implied by role language.",',
  '    "certifications": "Named certifications and licenses with issuer/year if given.",',
  '    "languages": "Human languages and level (e.g. Spanish — Professional) if stated.",',
  '    "toolsPlatforms": "CRM, ad platforms, ATS, collaboration tools (Slack, Notion), social platforms used professionally—dedupe from technical if needed."',
  '  },',
  '  "additionalExperienceNotes": "Multi-line string: for EVERY paid, volunteer, or project role, one line each: Organization — Title — Dates — very short scope (resume facts only). Include internships; repeat roles from keyDetails here in this index format. If only one job, include that line.",',
  '  "resumeNotesForAi": "e.g. Auto-filled from uploaded resume PDF. Add industries or job types only if clearly stated in the resume; else empty string."',
  '}',
  '',
  'Rules:',
  '- Use ONLY information supported by the resume text. Do not fabricate employers, titles, dates, degrees, metrics, or tools.',
  '- Be thorough: empty fields should mean the resume truly had nothing for that slot, not that you skipped extraction.',
  '- Do not include resumeIncludedExperienceIds or resumeIncludedProjectIds.',
  '- Output ONLY valid JSON. No markdown code fences, no commentary before or after.'
].join('\n');

/**
 * @param {string} text
 * @returns {object}
 */
function parseAssistantJson(text) {
  let t = String(text || '').trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```/im.exec(t);
  if (fence) {
    t = fence[1].trim();
  }
  return JSON.parse(t);
}

function resolveModel() {
  return (
    process.env.RESUME_AUTOFILL_MODEL ||
    process.env.COVER_LETTER_MODEL ||
    process.env.JOB_HUNTER_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5'
  );
}

/**
 * @param {string} resumeText
 * @returns {Promise<object>}
 */
async function profileFromResumeText(resumeText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const trimmed = String(resumeText || '').trim().slice(0, 96000);
  if (!trimmed) {
    throw new Error('Resume text is empty');
  }

  const system =
    'You convert resume plain text into structured JSON for a job application profile. ' +
    'Populate all fields as completely as the source text allows.\n\n' +
    SCHEMA_INSTRUCTIONS;

  const user =
    'Resume text extracted from the user file (PDF or Word .docx). Extract and map ALL sections—header, summary, experience, education, skills, certifications, projects, volunteering:\n---\n' +
    trimmed +
    '\n---\n\n' +
    'Return the complete JSON object now. Double-check that applicant, headline, summary, keyDetails, targetSkillsToUse, locationsPreferred, roleTypesPreferred, education, skillsGroups, additionalExperienceNotes, and resumeNotesForAi are all present.';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: resolveModel(),
      max_tokens: 8192,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Claude API error ' + res.status + ': ' + errText.slice(0, 280));
  }

  const data = await res.json();
  const outText = anthropicMessageText(data).trim();
  if (!outText) {
    throw new Error('Empty response from Claude');
  }

  return parseAssistantJson(outText);
}

module.exports = {
  extractPdfText,
  extractResumeDocumentText,
  profileFromResumeText
};
