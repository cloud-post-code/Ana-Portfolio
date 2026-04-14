/**
 * Extract text from resume PDF and map to job-search-profile shape via Claude.
 */

const { anthropicMessageText } = require('./anthropic-text');

const SCHEMA_INSTRUCTIONS = [
  'Return a single JSON object with exactly these keys (use "" or [] when not found in the resume):',
  '{',
  '  "applicant": { "fullName", "email", "phone", "cityState", "linkedIn", "portfolio" },',
  '  "headline": "short professional headline if clearly inferable, else empty string",',
  '  "summary": "professional profile or objective from the resume",',
  '  "keyDetails": ["short bullet strings"] — strengths, focus areas, or themes; [] if none,',
  '  "targetSkillsToUse": ["skills or competencies to emphasize"],',
  '  "locationsPreferred": ["City, ST or region"] if relocation or location appears, else [],',
  '  "roleTypesPreferred": ["job titles or levels targeted"] if inferable, else [],',
  '  "education": [{ "degree", "dates", "institution", "location", "bullets" }],',
  '    bullets = honors, coursework, activities as plain text (newlines ok) or "",',
  '  "skillsGroups": {',
  '    "technical": "comma- or semicolon-separated tools, software, methods",',
  '    "professional": "soft skills, leadership, communication",',
  '    "certifications": "certificates and licenses",',
  '    "languages": "spoken languages and proficiency if stated",',
  '    "toolsPlatforms": "platforms and industry tools"',
  '  },',
  '  "additionalExperienceNotes": "brief summary of secondary roles if the resume has an additional experience section, else empty",',
  '  "resumeNotesForAi": ""',
  '}',
  'Do not include resumeIncludedExperienceIds or resumeIncludedProjectIds.',
  'Use only information explicitly supported by the resume text—do not invent employers, degrees, or metrics.',
  'Output ONLY valid JSON. No markdown fences, no commentary.'
].join('\n');

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, error: string|null }>}
 */
async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { text: '', error: 'Invalid PDF buffer' };
  }
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const text = String((data && data.text) || '').replace(/\r\n/g, '\n').trim();
    if (!text) {
      return { text: '', error: 'This PDF has no extractable text (it may be scanned images only).' };
    }
    return { text, error: null };
  } catch (e) {
    return { text: '', error: e.message || String(e) };
  }
}

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

  const trimmed = String(resumeText || '').trim().slice(0, 48000);
  if (!trimmed) {
    throw new Error('Resume text is empty');
  }

  const system =
    'You convert resume plain text into structured JSON for a job application profile.\n\n' + SCHEMA_INSTRUCTIONS;

  const user =
    'Resume text extracted from the user PDF:\n---\n' + trimmed + '\n---\n\nProduce the JSON object now.';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: resolveModel(),
      max_tokens: 4096,
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
  profileFromResumeText
};
