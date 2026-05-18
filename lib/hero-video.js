const path = require('path');
const fs = require('fs');
const cms = require('./cms-store');

const HERO_VIDEO_KV = 'hero_video';
const ROOT_DIR = path.join(__dirname, '..');

const EMPTY_META = {
  path: null,
  originalFilename: null,
  updatedAt: null,
  fileExists: false
};

async function getHeroVideoMeta() {
  const v = await cms.getKv(HERO_VIDEO_KV);
  const meta = v != null ? { ...EMPTY_META, ...v } : { ...EMPTY_META };
  const rel = meta.path ? String(meta.path).replace(/^\//, '') : '';
  meta.fileExists = !!(rel && fs.existsSync(path.join(ROOT_DIR, rel)));
  return meta;
}

function unlinkHeroVideoFile(relPath) {
  if (!relPath) return;
  const normalized = String(relPath).replace(/^\//, '');
  if (!normalized.startsWith('uploads/')) return;
  const abs = path.join(ROOT_DIR, normalized);
  try {
    if (fs.existsSync(abs)) fs.unlinkSync(abs);
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  HERO_VIDEO_KV,
  EMPTY_META,
  getHeroVideoMeta,
  unlinkHeroVideoFile
};
