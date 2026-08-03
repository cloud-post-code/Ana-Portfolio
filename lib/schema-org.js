/**
 * Schema.org JSON-LD builders for NLWeb / AI-agent consumption.
 * Pure functions over CMS items; absolute URLs come from siteOrigin.
 */

const PERSON_NAME = 'Ana Machuca';

function personSchema(siteOrigin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: PERSON_NAME,
    url: siteOrigin + '/',
    jobTitle: 'Marketing & Branding Professional',
    description:
      'Marketing and branding professional focused on humanizing brands: ' +
      'brand strategy, creative direction, visual identity, campaign development, and storytelling.',
    alumniOf: 'Hult International Business School',
    knowsAbout: [
      'Brand Strategy',
      'Creative Direction',
      'Visual Identity',
      'Marketing Campaigns',
      'Social Media',
      'Storytelling'
    ]
  };
}

function websiteSchema(siteOrigin) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Ana Machuca — Humanizing Brands',
    url: siteOrigin + '/',
    description: 'Marketing portfolio of Ana Machuca for recruiters and hiring managers.',
    author: { '@type': 'Person', name: PERSON_NAME }
  };
}

function itemUrl(siteOrigin, item, itemType) {
  const base = itemType === 'experience' ? '/experience/' : '/project/';
  return siteOrigin + base + item.slug;
}

function creativeWorkSchema(siteOrigin, item, itemType) {
  const deliverables = (item.deliverables || [])
    .map(d => (d.title ? d.title + (d.description ? ': ' + d.description : '') : ''))
    .filter(Boolean);
  const work = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: item.title,
    url: itemUrl(siteOrigin, item, itemType),
    description: item.description || '',
    author: { '@type': 'Person', name: PERSON_NAME },
    genre: itemType === 'experience' ? 'Work Experience' : 'Portfolio Project'
  };
  if (itemType === 'experience' && item.dateRange) work.temporalCoverage = item.dateRange;
  if (itemType === 'experience' && item.role) work.about = item.role + ' at ' + item.title;
  if (deliverables.length) work.hasPart = deliverables.map(t => ({ '@type': 'CreativeWork', name: t }));
  if (Array.isArray(item.skills) && item.skills.length) work.keywords = item.skills.join(', ');
  return work;
}

function visible(items) {
  return (items || []).filter(i => !i.hidden);
}

function homeSchemas(siteOrigin, experiences, projects) {
  const entries = visible(experiences)
    .map(e => creativeWorkSchema(siteOrigin, e, 'experience'))
    .concat(visible(projects).map(p => creativeWorkSchema(siteOrigin, p, 'project')));
  const list = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Portfolio of Ana Machuca',
    itemListElement: entries.map((s, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: s
    }))
  };
  return [personSchema(siteOrigin), websiteSchema(siteOrigin), list];
}

/** Flat catalog for /schema.json — NLWeb ingestion feed. */
function catalogSchemas(siteOrigin, experiences, projects) {
  return [personSchema(siteOrigin)]
    .concat(visible(experiences).map(e => creativeWorkSchema(siteOrigin, e, 'experience')))
    .concat(visible(projects).map(p => creativeWorkSchema(siteOrigin, p, 'project')));
}

module.exports = { personSchema, websiteSchema, creativeWorkSchema, homeSchemas, catalogSchemas };
