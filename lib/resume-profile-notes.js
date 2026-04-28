/**
 * Multiple persistent profile notes (KV + JSON file fallback via cms.setKv).
 * Legacy single-blob `resume_notes` is migrated once when empty profile list but legacy has content.
 */

const { v4: uuidv4 } = require('uuid');

const PROFILE_KV = 'resume_profile_notes';
const LEGACY_NOTES_KV = 'resume_notes';
/** Max saved profile notes (abuse guard). */
const MAX_PROFILE_NOTES = 100;

function normalizeItems(row) {
  if (!row || !Array.isArray(row.items)) return [];
  return row.items.filter(function (i) {
    return i && typeof i.id === 'string' && typeof i.content === 'string';
  });
}

/**
 * @param {*} cms - cms-store module
 * @returns {Promise<{ id: string, content: string, createdAt: string, updatedAt: string }[]>}
 */
async function getProfileNotesItems(cms) {
  let row = await cms.getKv(PROFILE_KV);
  let items = normalizeItems(row);
  if (items.length === 0) {
    const legacy = await cms.getKv(LEGACY_NOTES_KV);
    const legacyText = legacy && typeof legacy.content === 'string' ? String(legacy.content).trim() : '';
    if (legacyText) {
      const now = new Date().toISOString();
      items = [{ id: uuidv4(), content: legacyText, createdAt: now, updatedAt: now }];
      await cms.setKv(PROFILE_KV, { items });
      await cms.setKv(LEGACY_NOTES_KV, { content: '', updatedAt: now });
    }
  }
  return items.slice().sort(function (a, b) {
    return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
  });
}

/**
 * @param {*} cms - cms-store module
 * @returns {Promise<string>} Combined text for tailor / cover letter (legacy shape for prompts).
 */
async function getCombinedProfileNotesText(cms) {
  const items = await getProfileNotesItems(cms);
  return items
    .map(function (i) {
      return String(i.content || '').trim();
    })
    .filter(Boolean)
    .join('\n\n---\n\n');
}

/**
 * @param {*} cms - cms-store module
 * @returns {Promise<number>}
 */
async function getProfileNotesCount(cms) {
  const items = await getProfileNotesItems(cms);
  return items.length;
}

/**
 * @param {*} cms - cms-store module
 * @param {{ id: string, content: string, createdAt: string, updatedAt: string }[]} items
 */
async function saveProfileNotesItems(cms, items) {
  await cms.setKv(PROFILE_KV, { items });
}

/**
 * @param {*} cms - cms-store module
 * @param {string} content
 * @param {{ exceedsLineBudget: (s: string, max: number) => boolean, maxLines: number }} lineCheck
 * @param {number} maxChars
 * @returns {Promise<{ id: string, content: string, createdAt: string, updatedAt: string }>}
 */
async function addProfileNote(cms, content, lineCheck, maxChars) {
  const trimmed = String(content || '').trim();
  if (!trimmed) {
    throw new Error('Note content is required.');
  }
  if (Buffer.byteLength(trimmed, 'utf8') > maxChars) {
    throw new Error('Note is too long (max ' + maxChars + ' characters).');
  }
  if (lineCheck.exceedsLineBudget(trimmed, lineCheck.maxLines)) {
    throw new Error('Note must be at most ' + lineCheck.maxLines + ' lines.');
  }
  const items = await getProfileNotesItems(cms);
  if (items.length >= MAX_PROFILE_NOTES) {
    throw new Error('Maximum ' + MAX_PROFILE_NOTES + ' profile notes — delete one before adding another.');
  }
  const now = new Date().toISOString();
  const note = { id: uuidv4(), content: trimmed, createdAt: now, updatedAt: now };
  const merged = items.concat([note]);
  await saveProfileNotesItems(cms, merged);
  return note;
}

/** UUID v4 from the uuid package (and migrated ids). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * @param {*} cms - cms-store module
 * @param {string} id
 * @returns {Promise<boolean>} true if a row was removed
 */
async function deleteProfileNoteById(cms, id) {
  const sid = String(id || '').trim();
  if (!sid || !UUID_RE.test(sid)) {
    throw new Error('Invalid note id.');
  }
  const items = await getProfileNotesItems(cms);
  const next = items.filter(function (i) {
    return i.id !== sid;
  });
  if (next.length === items.length) {
    return false;
  }
  await saveProfileNotesItems(cms, next);
  return true;
}

module.exports = {
  PROFILE_KV,
  LEGACY_NOTES_KV,
  MAX_PROFILE_NOTES,
  getProfileNotesItems,
  getCombinedProfileNotesText,
  getProfileNotesCount,
  addProfileNote,
  deleteProfileNoteById,
  saveProfileNotesItems
};
