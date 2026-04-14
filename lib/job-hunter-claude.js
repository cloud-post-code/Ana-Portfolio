/**
 * Load skills/job-hunter (SKILL.md + references) and call Claude with optional Tavily web context.
 */

const fs = require('fs');
const { anthropicMessageText } = require('./anthropic-text');
const path = require('path');
const { dedupeTavilyResults } = require('./tavily-dedupe');

const SKILL_ROOT = path.join(__dirname, '..', 'skills', 'job-hunter');

const DEFAULT_TARGET_JOBS = 8;
const MIN_TARGET_JOBS = 1;
const MAX_TARGET_JOBS = 25;

function normalizeTargetJobCount(n) {
  const x = parseInt(String(n == null ? '' : n), 10);
  if (Number.isNaN(x)) return DEFAULT_TARGET_JOBS;
  return Math.min(MAX_TARGET_JOBS, Math.max(MIN_TARGET_JOBS, x));
}

/** Must match admin Job CRM columns (subset) so the UI can render a real table. */
const JOB_HUNTER_CRM_TABLE_SPEC =
  '\n\n---\n## Portfolio Job CRM table (mandatory for Open Roles)\n' +
  'Under the heading `#### 📋 Open Roles`, include **exactly one** markdown pipe table.\n' +
  'The **header row must be copied verbatim** (same columns, same order):\n\n' +
  '| # | Company | Role | Yrs exp | Job details | Location | Deadline | Status | Priority | Tags | Listing |\n' +
  '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n\n' +
  'Row rules (fill as accurately as the evidence allows):\n' +
  '- **#**: row number starting at 1.\n' +
  '- **Company** / **Role**: from the listing or snippet; no invented employers. If you truly cannot name one, use `—` for that cell only.\n' +
  '- **Yrs exp**: copy the **exact** experience phrase from the posting (e.g. `2+ years`, `0–1 years`, `Entry level`). **Default when unknown:** `—`.\n' +
  '- **Job details** (for resume + cover letter): include **4–8** concise clauses (use `; ` between ideas, no `|`). Be **substantial**—enough to fill a long CRM notes field. Cover: responsibilities; must-have vs nice-to-have skills/tools; team or stakeholders if stated; work arrangement (remote/hybrid/onsite); compensation only if explicitly stated. **Default when unknown:** `—`.\n' +
  '- **Location**: city/state or `Remote` / `Hybrid`. **Default when unknown:** `—`.\n' +
  '- **Deadline**: Prefer **YYYY-MM-DD** if the posting states a close date; use `Rolling` **only** if the posting explicitly says rolling / no close / ongoing. **Default when unknown:** `—` (do not guess).\n' +
  '- **Status**: **Default when unknown / new leads:** `To Apply`.\n' +
  '- **Priority**: **Default when unsure:** `Medium`. Use `High` / `Low` only when evidence supports it.\n' +
  '- **Tags**: 2–4 comma-separated labels. **Default when unknown:** `—`.\n' +
  '- **Listing** (source URL only): Must be the **exact** `https://…` string that **appears verbatim** in the **Supplemental web search snippets** block below—the Tavily result URL you used as evidence for this row’s company, role, and facts. Copy and paste that URL character-for-character. If snippets contain multiple URLs, pick the one whose title/content actually describes **this** vacancy. **Never** invent, paraphrase, or guess URLs. **Never** use `google.com/search`, search-result pages, or any URL that does not appear in the snippets. If no snippet URL clearly supports this row, use `—` for Listing.\n' +
  'Do not duplicate company+role+location already listed in the user CRM block.\n\n' +
  '### Double-check every lead (mandatory before you finish Open Roles)\n' +
  'For **each** row you plan to include, run through this checklist mentally (and fix or drop the row if it fails):\n' +
  '1. **Snippets vs row**: Company name, job title, and location should match what the Tavily/web snippets say for that vacancy. If snippets contradict the row, correct the row or remove it.\n' +
  '2. **Listing URL provenance**: The Listing cell must be a URL **copied exactly from the snippets** (or `—`). Do not substitute Google, Bing, or invented links.\n' +
  '3. **Hubs / search pages**: Reject generic career **hubs** and job-board **search** pages as Listing unless that exact hub URL appears in snippets and is the only source for the row.\n' +
  '4. **Second pass**: Re-read for duplicates; drop or fix any row whose Listing URL is not a verbatim snippet URL.\n' +
  'Prefer **fewer rows that pass this checklist** over many unverified leads.\n';

/** Overrides conversational “clarify first” behavior in bundled SKILL.md when running from the admin API. */
const PORTFOLIO_ADMIN_API_RULES =
  '\n\n---\n## Portfolio admin Job Hunter (this request — overrides clarifying steps)\n' +
  '- **Do not ask the user questions.** Never output “I need clarification”, “before I begin”, numbered questions, or any stall before producing results.\n' +
  '- **Always search and deliver in one response:** web snippets (when present) plus the user’s Search box and criteria are sufficient. Execute the workflow and **Step 7** immediately.\n' +
  '- If city, region, industry vertical, or marketing sub-focus is missing, **infer** from keywords, the CRM exclusion list (locations/companies), and common sense (e.g. US marketing roles). You may state **one short sentence** of assumptions *after* the Open Roles table, not as a blocker.\n' +
  '- **Lead with the structured report:** the first substantial content must be **Step 7** including **`#### 📋 Open Roles`** and the mandatory pipe table—not a Q&A preamble.\n';

function loadSkillBundle() {
  const parts = [];
  const main = path.join(SKILL_ROOT, 'SKILL.md');
  if (!fs.existsSync(main)) {
    throw new Error('Job Hunter skill not found at skills/job-hunter/SKILL.md');
  }
  parts.push(fs.readFileSync(main, 'utf8'));
  const refDir = path.join(SKILL_ROOT, 'references');
  if (fs.existsSync(refDir)) {
    fs.readdirSync(refDir)
      .filter(function (f) {
        return f.endsWith('.md');
      })
      .sort()
      .forEach(function (f) {
        parts.push(fs.readFileSync(path.join(refDir, f), 'utf8'));
      });
  }
  return parts.join('\n\n---\n\n');
}

async function loadExistingCrmForPrompt() {
  try {
    const { getJobsCrm } = require('./cms-store');
    const raw = await getJobsCrm();
    if (!Array.isArray(raw)) return [];
    return raw.map(function (j) {
      return {
        id: j.id,
        co: j.co,
        role: j.role,
        loc: j.loc || '',
        url: j.url || ''
      };
    });
  } catch (e) {
    return [];
  }
}

const TAVILY_MAX_QUERY = 500;
const MULTI_TAVILY_CAP = 20000;

/**
 * Single Tavily request; returns deduped result rows (not formatted string).
 */
async function tavilySearchRaw(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !String(query).trim()) return [];
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: String(query).slice(0, TAVILY_MAX_QUERY),
        search_depth: 'advanced',
        max_results: 8
      })
    });
    if (!res.ok) return [];
    const data = await res.json();
    return dedupeTavilyResults(data.results || []);
  } catch (e) {
    return [];
  }
}

function formatTavilyRowsToString(rows) {
  return rows
    .map(function (r) {
      return (r.title || '') + '\n' + (r.content || '') + '\n' + (r.url || '');
    })
    .join('\n---\n');
}

/** One query, formatted (backward compatible). */
async function tavilySearch(query) {
  const rows = await tavilySearchRaw(query);
  return formatTavilyRowsToString(rows).slice(0, 16000);
}

/**
 * Parallel Tavily queries (general + ATS-focused + careers wording), merged and deduped by URL.
 */
async function multiTavilySearch(combined, q) {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return '';

  const base = String(q || combined.slice(0, 400)).trim();
  if (!base) return '';

  const q1 = base.slice(0, TAVILY_MAX_QUERY);
  const q2 = (base + ' (greenhouse OR lever OR workday OR ashby) job').slice(0, TAVILY_MAX_QUERY);
  const q3 = (base + ' careers apply').slice(0, TAVILY_MAX_QUERY);

  const sets = await Promise.all([tavilySearchRaw(q1), tavilySearchRaw(q2), tavilySearchRaw(q3)]);
  const merged = dedupeTavilyResults([].concat(sets[0] || [], sets[1] || [], sets[2] || []));
  return formatTavilyRowsToString(merged).slice(0, MULTI_TAVILY_CAP);
}

/**
 * @param {{ criteria: string, searchQuery?: string, targetJobCount?: number, existingJobs?: Array<{ id?: string, co?: string, role?: string, loc?: string, url?: string }> }} opts
 * @returns {Promise<{ text: string, model: string, webSnippets: string, targetJobCount: number }>}
 */
async function runJobHunterSkill(opts) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Set ANTHROPIC_API_KEY on the server. Optional: TAVILY_API_KEY for live web snippets.'
    );
  }

  const q = String(opts.searchQuery || '').trim();
  const detail = String(opts.criteria || '').trim();
  const combined = [q, detail].filter(Boolean).join('\n\n');
  if (!combined) {
    throw new Error('Enter search criteria or a longer brief.');
  }

  const targetJobs = normalizeTargetJobCount(opts.targetJobCount);

  const skillText = loadSkillBundle();
  const webSnippets = await multiTavilySearch(combined, q || combined.slice(0, 400));

  const existingJobs = Array.isArray(opts.existingJobs)
    ? opts.existingJobs
    : await loadExistingCrmForPrompt();

  const system =
    'You execute the Job Hunter portfolio skill. The document below is your binding specification. ' +
    'Follow custom search rules and Step 7 output format. ' +
    'When web snippets are provided, use them as primary leads and cite that postings may change; verify URLs. ' +
    'Listing URLs must be copied verbatim from snippets—never invent or guess links. ' +
    'Every new job lead must be **double-checked** against the snippets and the double-check rules below: align company, title, location, and URL; reject search-page URLs. ' +
    'In the Open Roles table: each row must be a distinct vacancy—no duplicate company + role + location. ' +
    'Do not list openings that are already in the user CRM list provided below.' +
    JOB_HUNTER_CRM_TABLE_SPEC +
    '\n\n' +
    skillText +
    PORTFOLIO_ADMIN_API_RULES;

  const userParts = [];
  if (existingJobs.length) {
    const lines = existingJobs.slice(0, 250).map(function (e) {
      var line = '- ' + [e.co, e.role, e.loc].filter(Boolean).join(' · ');
      if (e.url) line += ' — ' + e.url;
      return line;
    });
    userParts.push(
      '### Already in Job CRM (do not repeat these as new leads; skip duplicates)\n' + lines.join('\n')
    );
  }
  if (webSnippets) {
    userParts.push(
      '### Supplemental web search snippets (deduplicated by URL; verify before applying)\n' + webSnippets
    );
  }
  userParts.push('### User criteria (mandatory constraints for custom search)\n' + combined);
  userParts.push(
    '### Target number of job leads\n' +
      'The user asked for **' +
      targetJobs +
      '** distinct vacancies in the **📋 Open Roles** table. Include **up to ' +
      targetJobs +
      '** data rows (numbered #1 … #' +
      targetJobs +
      ' when you have enough verified leads). If web snippets only support fewer high-quality, non-duplicative rows, include only those—do **not** invent postings to reach the count. Mention any shortfall briefly outside the table.'
  );
  userParts.push(
    '### Listing column (every row)\n' +
      'For each Open Roles row, the Listing cell must be the **exact** snippet URL (from the **Supplemental web search snippets** above) that supports that row—or `—` if none applies. **Do not** output Google search URLs or URLs not present in the snippets.'
  );
  userParts.push(
    'Produce the **full Step 7 structured report now** (no questions). The **#### 📋 Open Roles** subsection must appear promptly and use the mandatory Job CRM markdown table (exact header row and column order). ' +
      'After drafting Open Roles, **re-verify** each row against the snippets and the double-check rules; remove or correct any row that fails. ' +
      'Fill other Step 7 subsections (resume must-haves, alumni, etc.) as well as you can from snippets; use brief placeholders only if needed—**never** replace the Open Roles table with a request for user input.'
  );
  const userContent = userParts.join('\n\n');

  const model = process.env.JOB_HUNTER_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';
  const maxTokens = targetJobs > 12 ? 16384 : 8192;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: maxTokens,
      system: system,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Claude API error ' + res.status + ': ' + errText.slice(0, 280));
  }

  const data = await res.json();
  const text = anthropicMessageText(data);
  if (!text) {
    throw new Error('Empty response from Claude');
  }

  return { text, model, webSnippets, targetJobCount: targetJobs };
}

module.exports = {
  loadSkillBundle,
  runJobHunterSkill,
  normalizeTargetJobCount,
  DEFAULT_TARGET_JOBS,
  MIN_TARGET_JOBS,
  MAX_TARGET_JOBS,
  tavilySearch,
  multiTavilySearch,
  tavilySearchRaw
};
