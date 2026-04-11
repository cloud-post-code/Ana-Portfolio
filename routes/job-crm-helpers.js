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
    job.role,
    job.notes,
    job.co,
    job.deadline,
    job.yoe
  ].join(' ');
  const ids = [];
  TRACK_DEFS.forEach(function (def) {
    if (def.test(blob)) ids.push(def.id);
  });
  return ids.length ? ids : ['unclassified'];
}

module.exports = {
  regionFromLoc,
  tracksForJob,
  TRACK_DEFS
};
