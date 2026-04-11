/**
 * Build a plain-text cover letter from portfolio experiences + CRM job + optional profile.
 */

function slugify(text) {
  return String(text || 'company')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 48) || 'company';
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ');
}

function scoreExperienceForJob(exp, job) {
  const jobBlob = norm(
    [...(job.tags || []), ...(job.skills || []), job.role, job.notes, job.co].join(' ')
  );
  let score = 0;
  (exp.skills || []).forEach(function (sk) {
    const t = norm(sk);
    if (t.length < 3) return;
    const words = t.split(/\s+/).filter(Boolean);
    words.forEach(function (w) {
      if (w.length > 3 && jobBlob.includes(w)) score += 2;
    });
    if (jobBlob.includes(t.slice(0, 12))) score += 3;
  });
  const expBlob = norm([exp.title, exp.role, exp.type, exp.description, exp.company].join(' '));
  norm(job.role)
    .split(/\s+/)
    .forEach(function (w) {
      if (w.length > 4 && expBlob.includes(w)) score += 1;
    });
  return score;
}

function pickExperiences(experiences, job, max) {
  return (experiences || [])
    .map(function (e) {
      return { exp: e, score: scoreExperienceForJob(e, job) };
    })
    .sort(function (a, b) {
      return b.score - a.score || (a.exp.order || 0) - (b.exp.order || 0);
    })
    .slice(0, max)
    .map(function (x) {
      return x.exp;
    });
}

function shorten(text, maxLen) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen - 1).trim() + '…';
}

/**
 * @param {{ job: object, experiences: object[], profile: object|null }} opts
 * @returns {string}
 */
function generateCoverLetter(opts) {
  const job = opts.job;
  const experiences = opts.experiences || [];
  const profile = opts.profile || {};
  const applicant = profile.applicant || {};

  const name = applicant.fullName || '[Your name]';
  const email = applicant.email || '';
  const cityState = applicant.cityState || '';
  const phone = applicant.phone || '';

  const company = job.co || 'the organization';
  const role = job.role || 'the marketing role';
  const jobNotes = shorten(job.notes || '', 220);

  const dateStr = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const picked = pickExperiences(experiences, job, 2);
  const summaryLine = profile.summary
    ? shorten(profile.summary, 280)
    : '';

  const lines = [];

  lines.push(name);
  if (email) lines.push(email);
  if (phone) lines.push(phone);
  if (cityState) lines.push(cityState);
  lines.push('');
  lines.push(dateStr);
  lines.push('');
  lines.push('Hiring Team');
  lines.push(company);
  lines.push('');
  lines.push('Dear Hiring Manager,');
  lines.push('');

  let opening =
    `I am writing to express my interest in the ${role} role at ${company}. `;
  if (jobNotes) {
    opening += `The posting’s emphasis on ${jobNotes.toLowerCase().replace(/\.$/, '')} aligns with how I approach marketing work. `;
  } else {
    opening +=
      'I would welcome the chance to contribute to your team and help bring thoughtful, audience-centered campaigns to life. ';
  }
  if (summaryLine) {
    opening += `Professionally, I am focused on ${summaryLine.charAt(0).toLowerCase() + summaryLine.slice(1)}`;
    if (!summaryLine.endsWith('.')) opening += '.';
    else opening += ' ';
  }
  lines.push(opening.trim());
  lines.push('');

  if (picked.length) {
    picked.forEach(function (exp, i) {
      const title = exp.title || exp.company || 'my recent role';
      const expRole = exp.role || exp.type || 'marketing';
      const desc = shorten(exp.description || '', 420);
      const prefix = i === 0 ? 'Most recently' : 'Previously';
      lines.push(
        `${prefix}, as ${expRole} with ${title}, ${desc.charAt(0).toLowerCase() + desc.slice(1)}`
      );
      lines.push('');
    });
  } else {
    lines.push(
      'Through my marketing experience, I have built strengths in execution, collaboration, and clear communication with stakeholders.'
    );
    lines.push('');
  }

  const skillHints = []
    .concat(profile.targetSkillsToUse || [])
    .concat((job.skills || []).slice(0, 5))
    .filter(Boolean);
  const uniqueSkills = [...new Set(skillHints)].slice(0, 6);
  if (uniqueSkills.length) {
    lines.push(
      `For this position, I would bring ${uniqueSkills.slice(0, 4).join(', ')}${
        uniqueSkills.length > 4 ? ', and related strengths drawn from hands-on projects' : ''
      }. I learn quickly in fast-moving environments and care about measurable outcomes as well as creative quality.`
    );
  } else {
    lines.push(
      'I am eager to apply my experience in campaign execution, digital channels, and cross-functional collaboration to support your goals.'
    );
  }
  lines.push('');
  lines.push(
    `Thank you for considering my application. I would value the opportunity to discuss how my background can support ${company}’s work in the ${role} capacity.`
  );
  lines.push('');
  lines.push('Sincerely,');
  lines.push(name);

  return lines.join('\n');
}

module.exports = { generateCoverLetter, slugify };
