/**
 * Region bucket for CRM filters (matches `data-region` on table rows).
 */
function regionFromLoc(loc) {
  const s = String(loc || '').toLowerCase();
  if (/boston|cambridge|ma\b|massachusetts|needham|newton|quincy|woburn|marlborough|medford|somerville|brookline/i.test(s)) {
    return 'boston';
  }
  if (/new york|nyc|manhattan|brooklyn|queens|ny\b/i.test(s)) {
    return 'nyc';
  }
  if (/rhode|providence|warwick|pawtucket|woonsocket|central falls|ri\b/i.test(s)) {
    return 'ri';
  }
  if (/remote|anywhere|us national|united states/i.test(s)) {
    return 'remote';
  }
  return 'other';
}

const TRACK_DEFS = [
  { id: 'brand-campaigns', label: 'Brand & campaigns', test: (blob) => /brand|campaign|activation|creative|content strategy/i.test(blob) },
  { id: 'digital-growth', label: 'Digital & growth', test: (blob) => /digital|social|seo|email|crm|paid|performance|growth|influencer|lifecycle/i.test(blob) },
  { id: 'analytics', label: 'Analytics & insights', test: (blob) => /analytic|data|dashboard|reporting|measurement|science/i.test(blob) },
  { id: 'coordinator-ops', label: 'Coordinator / ops', test: (blob) => /coordinator|assistant|operations|project/i.test(blob) },
  { id: 'agency', label: 'Agency / client', test: (blob) => /agency|client|account|studio/i.test(blob) },
  { id: 'b2b-corp', label: 'B2B / corporate', test: (blob) => /b2b|corporate|enterprise|financial|consulting/i.test(blob) },
  { id: 'cpg-retail', label: 'CPG / retail / hospitality', test: (blob) => /cpg|retail|consumer|hospitality|hotel|restaurant|beverage|beauty|luxury fashion/i.test(blob) },
  { id: 'media-ent', label: 'Media & entertainment', test: (blob) => /media|entertainment|publish|broadcast|music|streaming/i.test(blob) },
  { id: 'health-nonprofit', label: 'Healthcare / nonprofit', test: (blob) => /health|hospital|nonprofit|foundation|education|university|museum/i.test(blob) }
];

function tracksForJob(job) {
  const blob = [
    ...(job.tags || []),
    ...(job.skills || []),
    job.role,
    job.notes,
    job.co
  ].join(' ');
  const ids = [];
  TRACK_DEFS.forEach(function (def) {
    if (def.test(blob)) ids.push(def.id);
  });
  return ids.length ? ids : ['unclassified'];
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(function (w) {
      return w.length > 4;
    });
}

/**
 * Match portfolio experiences to CRM jobs for "potential connections" ideas.
 */
function buildConnectionSuggestions(experiences, jobs) {
  const list = [];
  (experiences || []).forEach(function (exp) {
    const expSkills = exp.skills || [];
    const expBlob = [exp.title, exp.role, exp.description, exp.company, expSkills.join(' ')].join(' ').toLowerCase();
    const expTokens = tokenize(expBlob);
    const scored = jobs
      .map(function (j) {
        let score = 0;
        const jBlob = [
          ...(j.tags || []),
          ...(j.skills || []),
          j.role,
          j.notes,
          j.co,
          j.loc
        ]
          .join(' ')
          .toLowerCase();
        expSkills.forEach(function (sk) {
          const k = sk.toLowerCase();
          if (k.length > 3 && jBlob.includes(k)) score += 3;
          k.split(/\s+/).forEach(function (part) {
            if (part.length > 4 && jBlob.includes(part)) score += 1;
          });
        });
        expTokens.forEach(function (t) {
          if (jBlob.includes(t)) score += 1;
        });
        return { job: j, score };
      })
      .filter(function (x) {
        return x.score > 0;
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 5);

    if (scored.length) {
      list.push({
        experienceId: exp.id,
        experienceTitle: exp.title,
        experienceRole: exp.role,
        experienceCompany: exp.company,
        topSkills: expSkills.slice(0, 8),
        matches: scored.map(function (s) {
          return {
            job: s.job,
            score: s.score
          };
        })
      });
    }
  });
  return list.slice(0, 10);
}

module.exports = {
  regionFromLoc,
  tracksForJob,
  TRACK_DEFS,
  buildConnectionSuggestions
};
