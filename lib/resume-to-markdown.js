/**
 * Turn plain text from a PDF or Word resume into a stored .md file body.
 */

/**
 * @param {string} plainText
 * @param {string} [sourceFilename]
 * @returns {string}
 */
function buildResumeMarkdown(plainText, sourceFilename) {
  const safeName = String(sourceFilename || 'upload')
    .replace(/[\r\n]+/g, ' ')
    .replace(/-->/g, '')
    .trim()
    .slice(0, 200);
  const normalized = String(plainText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return `<!-- Source: ${safeName || 'upload'} -->\n\n${normalized}\n`;
}

module.exports = { buildResumeMarkdown };
