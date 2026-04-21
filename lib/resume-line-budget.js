/**
 * Line counting for resume notes, tailored resume, and cover letter.
 * MAX_RESUME_PAGE_LINES approximates one US Letter page of body text at typical resume formatting.
 */

const DEFAULT_MAX_RESUME_PAGE_LINES = 48;
const DEFAULT_MAX_COVER_LETTER_LINES = 40;

/**
 * Count lines including blank lines (split on newline). Empty string => 0 lines.
 * @param {string} text
 * @returns {number}
 */
function countLines(text) {
  const s = String(text ?? '');
  if (!s) return 0;
  return s.split('\n').length;
}

function parsePositiveInt(envVal, fallback) {
  const n = parseInt(String(envVal || '').trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function getMaxResumePageLines() {
  return parsePositiveInt(process.env.MAX_RESUME_PAGE_LINES, DEFAULT_MAX_RESUME_PAGE_LINES);
}

function getMaxCoverLetterLines() {
  return parsePositiveInt(process.env.MAX_COVER_LETTER_LINES, DEFAULT_MAX_COVER_LETTER_LINES);
}

/**
 * @param {string} text
 * @param {number} maxLines
 * @returns {boolean}
 */
function exceedsLineBudget(text, maxLines) {
  return countLines(text) > maxLines;
}

module.exports = {
  countLines,
  getMaxResumePageLines,
  getMaxCoverLetterLines,
  exceedsLineBudget,
  DEFAULT_MAX_RESUME_PAGE_LINES,
  DEFAULT_MAX_COVER_LETTER_LINES
};
