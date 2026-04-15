/**
 * AI-written cover letter (OpenAI or Anthropic) grounded in CRM job + portfolio experiences + profile.
 * Falls back to template via generateCoverLetterSmart when API unavailable.
 */

const { completeChatLlm } = require('./llm-chat');
const { DEFAULT_OPENAI_CHAT_MODEL } = require('./openai-defaults');
const { generateCoverLetter, pickExperiences } = require('./cover-letter');

function trimBlock(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + '…';
}

function formatExperiencesForPrompt(experiences) {
  return (experiences || []).map(function (e, i) {
    const lines = [];
    lines.push('### Experience ' + (i + 1));
    lines.push('- Organization / title: ' + (e.title || e.company || '—'));
    if (e.company && e.title && String(e.company).trim() !== String(e.title).trim()) {
      lines.push('- Company / location line: ' + e.company);
    }
    if (e.role) lines.push('- Role: ' + e.role);
    if (e.type) lines.push('- Type: ' + e.type);
    if (e.dateRange) lines.push('- Dates: ' + e.dateRange);
    if (e.description) lines.push('- Summary: ' + trimBlock(e.description, 900));
    const skills = (e.skills || []).slice(0, 14);
    if (skills.length) lines.push('- Skills / tools: ' + skills.join(', '));
    return lines.join('\n');
  }).join('\n\n');
}

function formatProfileForPrompt(profile) {
  const p = profile || {};
  const app = p.applicant || {};
  const lines = [];
  lines.push('- Full name: ' + (app.fullName || '[name not set in job-search-profile.json]'));
  if (app.email) lines.push('- Email: ' + app.email);
  if (app.phone) lines.push('- Phone: ' + app.phone);
  if (app.cityState) lines.push('- City / state: ' + app.cityState);
  if (app.linkedIn) lines.push('- LinkedIn: ' + app.linkedIn);
  if (app.portfolio) lines.push('- Portfolio / site: ' + app.portfolio);
  if (p.headline) lines.push('- Headline: ' + p.headline);
  if (p.summary) lines.push('- Career summary / goals: ' + trimBlock(p.summary, 2000));
  if (Array.isArray(p.keyDetails) && p.keyDetails.length) {
    lines.push('- Preferences / key details:');
    p.keyDetails.forEach(function (d) {
      lines.push('  - ' + d);
    });
  }
  if (Array.isArray(p.targetSkillsToUse) && p.targetSkillsToUse.length) {
    lines.push('- Skills to emphasize: ' + p.targetSkillsToUse.join('; '));
  }
  if (Array.isArray(p.locationsPreferred) && p.locationsPreferred.length) {
    lines.push('- Locations / markets of interest: ' + p.locationsPreferred.join('; '));
  }
  if (Array.isArray(p.roleTypesPreferred) && p.roleTypesPreferred.length) {
    lines.push('- Role types of interest: ' + p.roleTypesPreferred.join(', '));
  }
  const sg = p.skillsGroups || {};
  const sgBits = [
    sg.technical && 'Technical: ' + trimBlock(sg.technical, 500),
    sg.professional && 'Professional: ' + trimBlock(sg.professional, 500),
    sg.certifications && 'Certifications: ' + trimBlock(sg.certifications, 400),
    sg.languages && 'Languages: ' + trimBlock(sg.languages, 200),
    sg.toolsPlatforms && 'Tools / platforms: ' + trimBlock(sg.toolsPlatforms, 500)
  ].filter(Boolean);
  if (sgBits.length) {
    lines.push('- Skills (grouped): ' + sgBits.join(' | '));
  }
  if (Array.isArray(p.education) && p.education.length) {
    lines.push('- Education (structured):');
    p.education.slice(0, 6).forEach(function (ed) {
      if (!ed || typeof ed !== 'object') return;
      const bit = [ed.degree, ed.institution, ed.dates, ed.location].filter(Boolean).join(' · ');
      if (bit) lines.push('  - ' + bit);
    });
  }
  if (p.additionalExperienceNotes && String(p.additionalExperienceNotes).trim()) {
    lines.push('- Additional experience notes: ' + trimBlock(p.additionalExperienceNotes, 1200));
  }
  if (p.resumeNotesForAi && String(p.resumeNotesForAi).trim()) {
    lines.push('- Notes for AI (resume/cover constraints): ' + trimBlock(p.resumeNotesForAi, 1500));
  }
  return lines.join('\n');
}

/**
 * @param {{ job: object, experiences: object[], profile: object|null }} opts
 * @returns {Promise<string>}
 */
async function generateCoverLetterWithAI(opts) {
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    throw new Error('OPENAI_API_KEY or ANTHROPIC_API_KEY is not set');
  }

  const job = opts.job || {};
  const profile = opts.profile || {};
  const experiences = opts.experiences || [];
  const picked = pickExperiences(experiences, job, 4);

  const anthropicModel =
    process.env.COVER_LETTER_MODEL ||
    process.env.JOB_HUNTER_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5';

  const system = [
    'You write professional, persuasive cover letters for job applications.',
    'Use ONLY facts from the structured briefing below—do not invent employers, job titles, dates, degrees, metrics, or tools that are not supported by the briefing.',
    'Ground the letter in: (1) the target job title and the posting’s experience / seniority language (YoE field), (2) the applicant’s listed experiences, and (3) job details/requirements when provided.',
    'Match tone to seniority implied by the job title and YoE (e.g. internship vs associate vs senior).',
    'Output plain text only—no markdown headings (no # or ###), no bullet lists unless a short inline list is natural inside a paragraph. Suitable for pasting into Microsoft Word.',
    'Use a standard business letter: applicant contact lines if provided, date (spell out month day, year), recipient line (e.g. Hiring Team + company), "Dear Hiring Manager," body paragraphs, "Sincerely," and the applicant’s name.',
    'Aim for roughly 320–520 words unless the briefing is very thin; then keep it shorter and avoid padding.'
  ].join('\n');

  const user =
    '## Target role\n' +
    '- Company: ' +
    (job.co || '—') +
    '\n' +
    '- Job title: ' +
    (job.role || '—') +
    '\n' +
    '- Experience / seniority from posting (YoE field): ' +
    (job.yoe ? String(job.yoe) : '— (not specified in CRM)') +
    '\n' +
    '- Location: ' +
    (job.loc || '—') +
    '\n' +
    (Array.isArray(job.tags) && job.tags.length
      ? '- Tags: ' + job.tags.join(', ') + '\n'
      : '') +
    '- Job details / requirements (from CRM; mirror phrasing where honest):\n' +
    trimBlock(job.notes || '—', 6500) +
    '\n\n' +
    '## Applicant (profile)\n' +
    formatProfileForPrompt(profile) +
    '\n\n' +
    '## Relevant portfolio experiences (prioritized for this role)\n' +
    (picked.length
      ? formatExperiencesForPrompt(picked)
      : '_No portfolio experiences matched; write a shorter letter and lean on profile + job details only._') +
    '\n\n' +
    'Write the full cover letter now.';

  const r = await completeChatLlm({
    system,
    user,
    maxTokens: 2500,
    temperature: 0.2,
    openaiModel: process.env.OPENAI_MODEL || DEFAULT_OPENAI_CHAT_MODEL,
    anthropicModel
  });
  return r.text;
}

/**
 * Uses OpenAI or Anthropic when a key is set and COVER_LETTER_AI is not "0".
 * Otherwise uses the deterministic template from cover-letter.js.
 *
 * @param {{ job: object, experiences: object[], profile: object|null }} opts
 * @returns {Promise<string>}
 */
async function generateCoverLetterSmart(opts) {
  const useAi =
    (process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY) &&
    String(process.env.COVER_LETTER_AI || '').trim() !== '0';
  if (!useAi) {
    return generateCoverLetter(opts);
  }
  try {
    return await generateCoverLetterWithAI(opts);
  } catch (e) {
    console.warn('[cover-letter-ai] AI generation failed, using template:', e.message || e);
    return generateCoverLetter(opts);
  }
}

module.exports = {
  generateCoverLetterWithAI,
  generateCoverLetterSmart,
  formatExperiencesForPrompt
};
