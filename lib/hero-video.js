const path = require('path');
const fs = require('fs');
const cms = require('./cms-store');
const { getPool, isDatabaseEnabled } = require('./db');

const HERO_VIDEO_KV = 'hero_video';
const HERO_VIDEO_SERVE_PATH = '/hero-video/file';
const ROOT_DIR = path.join(__dirname, '..');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');

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

async function getHeroVideoBlobRow() {
  if (!isDatabaseEnabled()) return null;
  const r = await getPool().query(
    'SELECT data, mime_type, original_filename, updated_at FROM hero_video_blob WHERE id = 1'
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

async function setHeroVideoBlob(buffer, mimeType, originalFilename) {
  if (!isDatabaseEnabled()) throw new Error('Database required for hero video blob storage');
  await getPool().query(
    `INSERT INTO hero_video_blob (id, data, mime_type, original_filename, updated_at)
     VALUES (1, $1, $2, $3, NOW())
     ON CONFLICT (id) DO UPDATE SET
       data = EXCLUDED.data,
       mime_type = EXCLUDED.mime_type,
       original_filename = EXCLUDED.original_filename,
       updated_at = NOW()`,
    [buffer, mimeType, originalFilename]
  );
}

async function deleteHeroVideoBlob() {
  if (!isDatabaseEnabled()) return;
  await getPool().query('DELETE FROM hero_video_blob WHERE id = 1');
}

async function getHeroVideoMeta() {
  const v = await cms.getKv(HERO_VIDEO_KV);
  const meta = v != null ? { ...EMPTY_META, ...v } : { ...EMPTY_META };

  if (meta.storage === 'database') {
    const blob = await getHeroVideoBlobRow();
    const hasData = !!(blob && blob.data && blob.data.length);
    meta.fileExists = hasData;
    meta.serveUrl = hasData ? HERO_VIDEO_SERVE_PATH : null;
    if (blob) {
      meta.mimeType = meta.mimeType || blob.mimeType;
      meta.originalFilename = meta.originalFilename || blob.originalFilename;
      meta.updatedAt = meta.updatedAt || (blob.updatedAt ? new Date(blob.updatedAt).toISOString() : null);
    }
    return meta;
  }

  const rel = meta.path ? String(meta.path).replace(/^\//, '') : '';
  meta.fileExists = !!(rel && fs.existsSync(path.join(ROOT_DIR, rel)));
  meta.serveUrl = meta.fileExists ? '/' + rel : null;
  return meta;
}

/** Stream hero video bytes from PostgreSQL (production). */
async function getHeroVideoForServe() {
  return getHeroVideoBlobRow();
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

function writeHeroVideoToDisk(buffer, originalFilename) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const ext = path.extname(originalFilename || '') || '.mp4';
  const filename = `${Date.now()}-hero${ext}`;
  const rel = `uploads/${filename}`;
  fs.writeFileSync(path.join(ROOT_DIR, rel), buffer);
  return rel;
}

async function removePreviousHeroVideo(prev) {
  if (!prev) return;
  if (prev.storage === 'database') {
    await deleteHeroVideoBlob();
  } else if (prev.path) {
    unlinkHeroVideoFile(prev.path);
  }
}

module.exports = {
  HERO_VIDEO_KV,
  HERO_VIDEO_SERVE_PATH,
  EMPTY_META,
  guessVideoMime,
  getHeroVideoMeta,
  getHeroVideoForServe,
  setHeroVideoBlob,
  deleteHeroVideoBlob,
  unlinkHeroVideoFile,
  writeHeroVideoToDisk,
  removePreviousHeroVideo
};
