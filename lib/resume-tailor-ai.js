/**
 * Job-tailored resume: LLM writes from profile + experiences + projects, then hiring-manager pass.
 */

const { completeChatLlm } = require('./llm-chat');
const { formatExperiencesForPrompt } = require('./cover-letter-ai');

function trimBlock(s, max) {
  const t = String(s || '').trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1).trim() + '…';
}

function formatProjectsForPrompt(projects) {
  return (projects || []).map(function (p, i) {
    const lines = [];
    lines.push('### Project ' + (i + 1));
    lines.push('- Title: ' + (p.title || '—'));
    if (p.sectionLabel) lines.push('- Context / section: ' + p.sectionLabel);
    if (p.description) lines.push('- Summary: ' + trimBlock(p.description, 900));
    const skills = (p.skills || []).slice(0, 14);
    if (skills.length) lines.push('- Skills / tools: ' + skills.join(', '));
    const dels = p.deliverables || [];
    if (dels.length) {
      const bits = dels.slice(0, 6).map(function (d) {
        return (d.title ? d.title + ': ' : '') + trimBlock(d.description || '', 200);
      });
      lines.push('- Deliverables / detail: ' + bits.join(' | '));
    }
    return lines.join('\n');
  }).join('\n\n');
}

function formatEducationForPrompt(education) {
  return (education || []).map(function (e, i) {
    const lines = [];
    lines.push('### Education ' + (i + 1));
    lines.push('- Degree or certification: ' + (e.degree || '—'));
    lines.push('- Dates: ' + (e.dates || '—'));
    lines.push('- Institution | location: ' + (e.institution || '—') + (e.location ? ' | ' + e.location : ''));
    if (e.bullets && String(e.bullets).trim()) {
      lines.push('- Bullets (one per line in source):');
      String(e.bullets)
        .split(/\n+/)
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(function (b) {
          lines.push('  • ' + b);
        });
    }
    return lines.join('\n');
  }).join('\n\n');
}

function formatStructuredProfileForPrompt(profile) {
  const p = profile || {};
  const app = p.applicant || {};
  const lines = [];
  lines.push('## Header (contact)');
  lines.push('- Full name: ' + (app.fullName || '—'));
  lines.push('- Location: ' + (app.cityState || '—'));
  lines.push('- Phone: ' + (app.phone || '—'));
  lines.push('- Email: ' + (app.email || '—'));
  lines.push('- LinkedIn: ' + (app.linkedIn || '—'));
  lines.push('- Portfolio: ' + (app.portfolio || '—'));
  if (p.headline) lines.push('- Headline: ' + trimBlock(p.headline, 200));
  if (p.summary) lines.push('- Career summary: ' + trimBlock(p.summary, 2500));
  if (Array.isArray(p.keyDetails) && p.keyDetails.length) {
    lines.push('- Key details:');
    p.keyDetails.forEach(function (d) {
      lines.push('  - ' + d);
    });
  }
  if (Array.isArray(p.targetSkillsToUse) && p.targetSkillsToUse.length) {
    lines.push('- Skills to emphasize (list):');
    p.targetSkillsToUse.forEach(function (s) {
      lines.push('  - ' + s);
    });
  }
  if (Array.isArray(p.locationsPreferred) && p.locationsPreferred.length) {
    lines.push('- Locations / markets of interest:');
    p.locationsPreferred.forEach(function (loc) {
      lines.push('  - ' + loc);
    });
  }
  if (Array.isArray(p.roleTypesPreferred) && p.roleTypesPreferred.length) {
    lines.push('- Role types of interest:');
    p.roleTypesPreferred.forEach(function (rt) {
      lines.push('  - ' + rt);
    });
  }
  lines.push('');
  lines.push('## Education (structured)');
  lines.push(p.education && p.education.length ? formatEducationForPrompt(p.education) : '_None provided._');
  lines.push('');
  const sg = p.skillsGroups || {};
  lines.push('## Skills & additional (grouped input)');
  lines.push('- Technical: ' + (sg.technical || '—'));
  lines.push('- Professional: ' + (sg.professional || '—'));
  lines.push('- Certifications / licenses: ' + (sg.certifications || '—'));
  lines.push('- Languages: ' + (sg.languages || '—'));
  lines.push('- Tools / platforms: ' + (sg.toolsPlatforms || '—'));
  if (p.additionalExperienceNotes && String(p.additionalExperienceNotes).trim()) {
    lines.push('');
    lines.push('## Additional experience notes (optional)');
    lines.push(trimBlock(p.additionalExperienceNotes, 2000));
  }
  if (p.resumeNotesForAi && String(p.resumeNotesForAi).trim()) {
    lines.push('');
    lines.push('## Applicant notes for this resume');
    lines.push(trimBlock(p.resumeNotesForAi, 8000));
  }
  return lines.join('\n');
}

function formatJobContext(job) {
  const j = job || {};
  return (
    '- Company: ' +
    (j.co || '—') +
    '\n' +
    '- Job title: ' +
    (j.role || '—') +
    '\n' +
    '- Experience / seniority (YoE field): ' +
    (j.yoe ? String(j.yoe) : '—') +
    '\n' +
    '- Location: ' +
    (j.loc || '—') +
    '\n' +
    (Array.isArray(j.tags) && j.tags.length ? '- Tags: ' + j.tags.join(', ') + '\n' : '') +
    '- Job details / requirements:\n' +
    trimBlock(j.notes || '—', 6500)
  );
}

/**
 * Pick experiences/projects by ID lists; null IDs means all non-hidden.
 */
function filterPortfolioForResume(items, ids) {
  const list = Array.isArray(items) ? items : [];
  if (ids == null) {
    return list.filter(function (x) {
      return !x.hidden;
    });
  }
  const set = new Set(ids);
  return list.filter(function (x) {
    return set.has(x.id);
  });
}

const RESUME_WRITER_SYSTEM = [
  'You are an expert resume writer and career strategist.',
  '',
  'Your task is to generate a clean, professional, and highly impactful resume for any user, regardless of industry, experience level, or background.',
  '',
  'You must transform raw user input into a polished resume using the following universal structure:',
  '',
  '---',
  '',
  '1. HEADER',
  '- Full Name (prominent)',
  '- Location | Phone | Email | LinkedIn or Portfolio (single line)',
  '',
  '---',
  '',
  '2. EDUCATION',
  'For each entry:',
  '- Degree or Certification',
  '- Dates (Month Year – Month Year or "Present")',
  '- Institution Name | Location',
  '- Bullet points (if applicable):',
  '  • Field of study, concentrations, or focus areas',
  '  • Honors, awards, GPA (if strong/relevant)',
  '  • Relevant coursework, projects, or academic achievements',
  '  • Leadership, extracurriculars, or notable distinctions',
  '',
  '---',
  '',
  '3. RELEVANT EXPERIENCE',
  'For each role:',
  '- Organization / Company | Location + Dates (right-aligned conceptually)',
  '- Job Title',
  '- 1-line summary describing overall responsibility, scope, or mission',
  '',
  'Bullet points:',
  '  • Start with strong action verbs',
  '  • Focus on achievements, not just responsibilities',
  '  • Quantify impact whenever possible (%, $, scale, time saved, growth, etc.)',
  '  • Highlight transferable skills (leadership, problem-solving, communication, technical ability)',
  '  • Show initiative, ownership, and outcomes',
  "  • Adapt language to fit the user's field (corporate, technical, creative, academic, trades, etc.)",
  '',
  '---',
  '',
  '4. ADDITIONAL EXPERIENCE (optional)',
  '- Include roles that are less relevant but show work ethic, progression, or transferable skills',
  '- Keep descriptions brief (1 line or short bullets)',
  '',
  '---',
  '',
  '5. PROJECTS (optional, include if relevant)',
  '- Project Name',
  '- Context (academic, personal, freelance, etc.)',
  '- Bullet points:',
  '  • What was built, created, or achieved',
  '  • Tools, technologies, or methods used',
  '  • Outcomes or impact',
  '',
  '---',
  '',
  '6. SKILLS & ADDITIONAL INFORMATION',
  'Group clearly when possible:',
  '- Technical Skills (tools, software, programming, equipment, etc.)',
  '- Professional Skills (leadership, communication, analysis, etc.)',
  '- Certifications / Licenses (if applicable)',
  '- Languages (if applicable)',
  '- Tools / Platforms (industry-specific)',
  '',
  '---',
  '',
  'WRITING STYLE REQUIREMENTS:',
  '- Concise, results-driven, and professional tone',
  '- No fluff, buzzwords, or generic statements',
  '- Use metrics and specifics whenever possible',
  '- Use present tense for current roles and past tense for previous roles',
  '- Avoid first-person pronouns',
  '- Make content adaptable to ANY field (business, tech, healthcare, education, trades, creative, etc.)',
  '- Emphasize transferable skills when direct experience is limited',
  '',
  '---',
  '',
  'FORMATTING RULES:',
  '- Use bullet points (•) consistently',
  '- Keep sections clearly separated',
  '- Ensure clean, modern, readable formatting',
  '- Keep bullets to 1–2 lines max',
  '- Prioritize clarity and impact over length',
  '',
  '---',
  '',
  'CRITICAL: Use ONLY facts supported by the INPUT below. Do not invent employers, job titles, dates, degrees, metrics, or tools that are not clearly grounded in the briefing. If information is missing, omit or use concise placeholders rather than fabricating.',
  'Tailor emphasis and ordering to align with the TARGET ROLE section without adding unsupported claims.',
  'Output plain text only—no markdown headings with #. Section titles as plain lines are fine.'
].join('\n');

function resolveAnthropicModel() {
  return (
    process.env.RESUME_TAILOR_MODEL ||
    process.env.COVER_LETTER_MODEL ||
    process.env.JOB_HUNTER_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5'
  );
}

async function llmMessage(system, user, maxTokens) {
  const r = await completeChatLlm({
    system,
    user,
    maxTokens,
    temperature: 0.2,
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    anthropicModel: resolveAnthropicModel()
  });
  return r.text;
}

/**
 * @param {{ job: object, profile: object, experiences: object[], projects: object[], userSuffix?: string, draftMaxTokens?: number }} opts
 * @returns {Promise<string>}
 */
async function generateTailoredResumeDraft(opts) {
  const job = opts.job || {};
  const profile = opts.profile || {};
  const experiences = opts.experiences || [];
  const projects = opts.projects || [];

  let user =
    '## TARGET ROLE (tailor toward this)\n' +
    formatJobContext(job) +
    '\n\n' +
    '## STRUCTURED PROFILE INPUT\n' +
    formatStructuredProfileForPrompt(profile) +
    '\n\n' +
    '## RELEVANT EXPERIENCE (portfolio — use for sections 3 and 4)\n' +
    (experiences.length
      ? formatExperiencesForPrompt(experiences)
      : '_No experiences selected._') +
    '\n\n' +
    '## PROJECTS (portfolio — use for section 5 when relevant)\n' +
    (projects.length ? formatProjectsForPrompt(projects) : '_No projects selected._') +
    '\n\n' +
    '---\n' +
    'OUTPUT: Return a fully formatted, professional resume tailored to this background and target role, following the required structure.';
  if (opts.userSuffix && String(opts.userSuffix).trim()) {
    user += '\n\n' + String(opts.userSuffix).trim();
  }
  const draftMax = opts.draftMaxTokens != null ? Number(opts.draftMaxTokens) : 8000;
  return llmMessage(RESUME_WRITER_SYSTEM, user, draftMax || 8000);
}

/**
 * @param {{ job: object, draftResumeText: string, maxTokens?: number }} opts
 * @returns {Promise<string>}
 */
async function refineResumeWithHiringManager(opts) {
  const job = opts.job || {};
  const draft = opts.draftResumeText || '';
  const refineMax = opts.maxTokens != null ? Number(opts.maxTokens) : 8000;
  const system = [
    'You are an experienced hiring manager reviewing a resume for a specific opening.',
    'Improve clarity, impact, and ATS readability while preserving factual accuracy.',
    'Do NOT invent or alter facts: employers, titles, dates, degrees, metrics, tools, or outcomes must remain faithful to the draft unless removing clear duplication.',
    'You may tighten wording, reorder bullets, improve parallel structure, and align keywords with the target role when supported by the draft.',
    'Keep the same major sections and plain-text style (bullet character • where used).',
    'Output the full revised resume only—no preamble or commentary.'
  ].join('\n');

  const user =
    'Target role: ' +
    (job.role || '—') +
    ' at ' +
    (job.co || '—') +
    '\nLocation: ' +
    (job.loc || '—') +
    '\n\n---\n\n' +
    draft;

  return llmMessage(system, user, Number(refineMax) || 8000);
}

/**
 * @param {{ job: object, profile: object, experiences: object[], projects: object[] }} opts
 * @returns {Promise<string>}
 */
async function generateTailoredResumeForJob(opts) {
  const ex = filterPortfolioForResume(opts.experiences || [], opts.profile && opts.profile.resumeIncludedExperienceIds);
  const pr = filterPortfolioForResume(opts.projects || [], opts.profile && opts.profile.resumeIncludedProjectIds);
  const draft = await generateTailoredResumeDraft({
    job: opts.job,
    profile: opts.profile,
    experiences: ex,
    projects: pr
  });
  return refineResumeWithHiringManager({ job: opts.job, draftResumeText: draft });
}

module.exports = {
  generateTailoredResumeForJob,
  generateTailoredResumeDraft,
  refineResumeWithHiringManager,
  filterPortfolioForResume,
  formatProjectsForPrompt
};
