/**
 * Extract plain text from resume source files (PDF or Word .docx) for JSON mapping.
 */

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, error: string|null }>}
 */
async function extractPdfText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { text: '', error: 'Invalid PDF buffer' };
  }
  try {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    const text = String((data && data.text) || '').replace(/\r\n/g, '\n').trim();
    if (!text) {
      return { text: '', error: 'This PDF has no extractable text (it may be scanned images only).' };
    }
    return { text, error: null };
  } catch (e) {
    return { text: '', error: e.message || String(e) };
  }
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ text: string, error: string|null }>}
 */
async function extractDocxText(buffer) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return { text: '', error: 'Invalid Word document buffer' };
  }
  try {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    const text = String((result && result.value) || '')
      .replace(/\r\n/g, '\n')
      .trim();
    if (!text) {
      return { text: '', error: 'No text could be read from this Word document.' };
    }
    return { text, error: null };
  } catch (e) {
    return { text: '', error: e.message || String(e) };
  }
}

/**
 * @param {Buffer} buffer
 * @param {string} ext — '.pdf' or '.docx' (lowercase)
 * @returns {Promise<{ text: string, error: string|null }>}
 */
async function extractResumeDocumentText(buffer, ext) {
  const e = String(ext || '').toLowerCase();
  if (e === '.docx') {
    return extractDocxText(buffer);
  }
  if (e === '.pdf') {
    return extractPdfText(buffer);
  }
  return {
    text: '',
    error: 'Unsupported format. Upload a PDF or a Word document saved as .docx.'
  };
}

module.exports = {
  extractPdfText,
  extractDocxText,
  extractResumeDocumentText
};
