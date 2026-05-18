const path = require('path');
const fs = require('fs');
const cms = require('./cms-store');
const { getPool, isDatabaseEnabled } = require('./db');

const HERO_VIDEO_KV = 'hero_video';
const HERO_VIDEO_VARIANTS = ['desktop', 'mobile'];
const HERO_VIDEO_DB_IDS = { desktop: 1, mobile: 2 };

const EMPTY_META = {
  storage: null,
  path: null,
  mimeType: null,
  originalFilename: null,
  updatedAt: null,
  fileExists: false,
  serveUrl: null
};

function guessVideoMime(ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.webm') return 'video/webm';
  if (e === '.mov') return 'video/quicktime';
  return 'video/mp4';
}

function servePathForVariant(variant) {
  return `/hero-video/file/${variant}`;
}

function normalizeHeroVideoKv(raw) {
  const empty = {
    desktop: { ...EMPTY_META },
    mobile: { ...EMPTY_META }
  };
  if (!raw || typeof raw !== 'object') return empty;

  if (raw.desktop || raw.mobile) {
    return {
      desktop: { ...EMPTY_META, ...(raw.desktop || {}) },
      mobile: { ...EMPTY_META, ...(raw.mobile || {}) }
    };
  }

  if (raw.storage || raw.path) {
    return {
      desktop: { ...EMPTY_META, ...raw },
      mobile: { ...EMPTY_META }
    };
  }

  return empty;
}

async function getHeroVideoBlobRow(variant) {
  if (!isDatabaseEnabled()) return null;
  const id = HERO_VIDEO_DB_IDS[variant];
  if (!id) return null;
  const r = await getPool().query(
    'SELECT data, mime_type, original_filename, updated_at FROM hero_video_blob WHERE id = $1',
    [id]
  );
  if (!r.rows.length) return null;
  const row = r.rows[0];
  return {
    data: row.data,
    mimeType: row.mime_type,
    originalFilename: row.original_filename,
    updatedAt: row.updated_at
  };
}

async function setHeroVideoBlob(buffer, mimeType, originalFilename, variant) {
  if (!isDatabaseEnabled()) throw new Error('Database required for hero video blob storage');
  const id = HERO_VIDEO_DB_IDS[variant];
  await getPool().query(
    `INSERT INTO hero_video_blob (id, data, mime_type, original_filename, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       data = EXCLUDED.data,
       mime_type = EXCLUDED.mime_type,
       original_filename = EXCLUDED.original_filename,
       updated_at = NOW()`,
    [id, buffer, mimeType, originalFilename]
  );
}

async function deleteHeroVideoBlob(variant) {
  if (!isDatabaseEnabled()) return;
  const id = HERO_VIDEO_DB_IDS[variant];
  await getPool().query('DELETE FROM hero_video_blob WHERE id = $1', [id]);
}

async function enrichVariantMeta(variant, meta) {
  const out = { ...EMPTY_META, ...meta };

  if (out.storage === 'database') {
    const blob = await getHeroVideoBlobRow(variant);
    const hasData = !!(blob && blob.data && blob.data.length);
    out.fileExists = hasData;
    out.serveUrl = hasData ? servePathForVariant(variant) : null;
    if (blob) {
      out.mimeType = out.mimeType || blob.mimeType;
      out.originalFilename = out.originalFilename || blob.originalFilename;
      out.updatedAt = out.updatedAt || (blob.updatedAt ? new Date(blob.updatedAt).toISOString() : null);
    }
    return out;
  }

  const rel = out.path ? String(out.path).replace(/^\//, '') : '';
  out.fileExists = !!(rel && fs.existsSync(path.join(ROOT_DIR, rel)));
  out.serveUrl = out.fileExists ? '/' + rel : null;
  return out;
}

const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

async function getHeroVideoMeta() {
  const v = await cms.getKv(HERO_VIDEO_KV);
  const normalized = normalizeHeroVideoKv(v);
  const desktop = await enrichVariantMeta('desktop', normalized.desktop);
  const mobile = await enrichVariantMeta('mobile', normalized.mobile);
  return { desktop, mobile };
}

/** Stream hero video bytes from PostgreSQL (production). */
async function getHeroVideoForServe(variant) {
  return getHeroVideoBlobRow(variant === 'mobile' ? 'mobile' : 'desktop');
}

function parseHeroVideoVariant(input) {
  const v = String(input || 'desktop').toLowerCase();
  if (v !== 'desktop' && v !== 'mobile') return null;
  return v;
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

function writeHeroVideoToDisk(buffer, originalFilename, variant) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const ext = path.extname(originalFilename || '') || '.mp4';
  const filename = `${Date.now()}-hero-${variant}${ext}`;
  const rel = `uploads/${filename}`;
  fs.writeFileSync(path.join(ROOT_DIR, rel), buffer);
  return rel;
}

async function removePreviousHeroVideo(prev) {
  if (!prev) return;
  if (prev.storage === 'database') {
    /* blob removed by variant-specific delete */
    return;
  }
  if (prev.path) {
    unlinkHeroVideoFile(prev.path);
  }
}

async function getHeroVideoKvRaw() {
  return cms.getKv(HERO_VIDEO_KV);
}

async function saveHeroVideoKv(normalized) {
  await cms.setKv(HERO_VIDEO_KV, normalized);
}

module.exports = {
  HERO_VIDEO_KV,
  HERO_VIDEO_VARIANTS,
  EMPTY_META,
  guessVideoMime,
  parseHeroVideoVariant,
  normalizeHeroVideoKv,
  getHeroVideoMeta,
  getHeroVideoForServe,
  setHeroVideoBlob,
  deleteHeroVideoBlob,
  unlinkHeroVideoFile,
  writeHeroVideoToDisk,
  removePreviousHeroVideo,
  getHeroVideoKvRaw,
  saveHeroVideoKv,
  servePathForVariant
};
