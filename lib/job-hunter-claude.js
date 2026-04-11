/**
 * Load skills/job-hunter (SKILL.md + references) and call Claude with optional Tavily web context.
 */

const fs = require('fs');
const path = require('path');
const { dedupeTavilyResults } = require('./tavily-dedupe');

const SKILL_ROOT = path.join(__dirname, '..', 'skills', 'job-hunter');
const JOBS_CRM_PATH = path.join(__dirname, '..', 'data', 'jobs-crm.json');

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

function loadExistingCrmForPrompt() {
  try {
    if (!fs.existsSync(JOBS_CRM_PATH)) return [];
    const raw = JSON.parse(fs.readFileSync(JOBS_CRM_PATH, 'utf8'));
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

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY;
  if (!key || !String(query).trim()) return '';
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query: String(query).slice(0, 500),
        search_depth: 'advanced',
        max_results: 8
      })
    });
    if (!res.ok) return '';
    const data = await res.json();
    const rows = dedupeTavilyResults(data.results || []);
    return rows
      .map(function (r) {
        return (r.title || '') + '\n' + (r.content || '') + '\n' + (r.url || '');
      })
      .join('\n---\n')
      .slice(0, 16000);
  } catch (e) {
    return '';
  }
}

/**
 * @param {{ criteria: string, searchQuery?: string, existingJobs?: Array<{ id?: string, co?: string, role?: string, loc?: string, url?: string }> }} opts
 * @returns {Promise<{ text: string, model: string }>}
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

  const skillText = loadSkillBundle();
  const webSnippets = await tavilySearch(q || combined.slice(0, 400));

  const existingJobs = Array.isArray(opts.existingJobs) ? opts.existingJobs : loadExistingCrmForPrompt();

  const system =
    'You execute the Job Hunter portfolio skill. The document below is your binding specification. ' +
    'Follow custom search rules, workflow order, and Step 7 output format. ' +
    'When web snippets are provided, use them as primary leads and cite that listings may change; verify URLs. ' +
    'Never invent apply links. ' +
    'In the Open Roles table: each row must be a distinct vacancy—no duplicate company + role + location. ' +
    'Do not list openings that are already in the user CRM list provided below.\n\n' +
    skillText;

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
    'Produce the full Step 7 structured report. If information is insufficient for a subsection, say what to search next.'
  );
  const userContent = userParts.join('\n\n');

  const model = process.env.JOB_HUNTER_MODEL || process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5';

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: model,
      max_tokens: 8192,
      system: system,
      messages: [{ role: 'user', content: userContent }]
    })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error('Claude API error ' + res.status + ': ' + errText.slice(0, 280));
  }

  const data = await res.json();
  const text =
    data.content &&
    data.content[0] &&
    data.content[0].text;
  if (!text) {
    throw new Error('Empty response from Claude');
  }

  return { text, model };
}

module.exports = { loadSkillBundle, runJobHunterSkill, tavilySearch };
