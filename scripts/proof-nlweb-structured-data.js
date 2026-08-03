/**
 * Proof for docs/features/nlweb-structured-data/PROOF.md.
 * Starts the server on a test port and asserts JSON-LD + /schema.json behavior.
 */
const { spawn } = require('child_process');
const path = require('path');

const PORT = process.env.PROOF_PORT || 3517;
const BASE = 'http://127.0.0.1:' + PORT;

function fail(msg) {
  console.error('PROOF FAIL: ' + msg);
  process.exit(1);
}

function extractJsonLd(html) {
  const blocks = [];
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(html))) blocks.push(JSON.parse(m[1]));
  return blocks.flat();
}

async function waitForServer(tries) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BASE + '/');
      if (r.ok) return;
    } catch (_) { /* not up yet */ }
    await new Promise(r => setTimeout(r, 300));
  }
  fail('server did not start on port ' + PORT);
}

async function main() {
  const server = spawn('node', [path.join(__dirname, '..', 'server.js')], {
    env: { ...process.env, PORT: String(PORT), DATABASE_URL: '' },
    stdio: 'ignore'
  });
  try {
    await waitForServer(30);

    const home = extractJsonLd(await (await fetch(BASE + '/')).text());
    const person = home.find(s => s['@type'] === 'Person');
    if (!person || person.name !== 'Ana Machuca') fail('homepage missing Person "Ana Machuca"');
    const list = home.find(s => s['@type'] === 'ItemList');
    if (!list || (list.itemListElement || []).length < 5) fail('homepage ItemList missing or < 5 items');

    const proj = extractJsonLd(await (await fetch(BASE + '/project/hult')).text());
    const projWork = proj.find(s => s['@type'] === 'CreativeWork');
    if (!projWork || projWork.name !== 'Hult') fail('/project/hult missing CreativeWork "Hult"');

    const exp = extractJsonLd(await (await fetch(BASE + '/experience/far-out-ice-cream')).text());
    if (!exp.find(s => s['@type'] === 'CreativeWork')) fail('/experience/far-out-ice-cream missing CreativeWork');

    const res = await fetch(BASE + '/schema.json');
    if (res.status !== 200) fail('/schema.json returned ' + res.status);
    if (!/application\/json/.test(res.headers.get('content-type') || '')) fail('/schema.json wrong content-type');
    const catalog = await res.json();
    if (!Array.isArray(catalog) || catalog.length < 5) fail('/schema.json array missing or < 5 items');
    for (const item of catalog) {
      if (!item['@context'] || !item['@type'] || !item.name || !/^https?:\/\//.test(item.url || '')) {
        fail('/schema.json item missing @context/@type/name/absolute url: ' + JSON.stringify(item).slice(0, 120));
      }
    }

    console.log('PROOF PASS: JSON-LD on /, /project/hult, /experience/far-out-ice-cream; /schema.json catalog of ' + catalog.length + ' items');
  } finally {
    server.kill();
  }
}

main().catch(e => fail(e.message || String(e)));
