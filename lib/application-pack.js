/**
 * Zip cover letter (.docx) + optional resume (PDF) for a single download.
 */

const path = require('path');

/**
 * @param {string} originalFilename
 * @returns {string}
 */
function safeResumeEntryName(originalFilename) {
  const base = path.basename(String(originalFilename || 'Resume.pdf'));
  if (!/^[\w.\- ()]+\.pdf$/i.test(base)) return 'Resume.pdf';
  return base.slice(0, 120);
}

/**
 * @param {{ coverDocxBuffer: Buffer, resumePdfBuffer?: Buffer|null, resumeEntryName?: string, slug: string }} opts
 * @returns {Promise<Buffer>}
 */
async function buildApplicationPackZip(opts) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const slug = String(opts.slug || 'company').replace(/[^\w-]+/g, '-').slice(0, 48) || 'company';

  zip.file(`Cover-letter-${slug}.docx`, opts.coverDocxBuffer);

  if (opts.resumePdfBuffer && Buffer.isBuffer(opts.resumePdfBuffer)) {
    const name = safeResumeEntryName(opts.resumeEntryName);
    zip.file(name, opts.resumePdfBuffer);
  }

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

module.exports = { buildApplicationPackZip, safeResumeEntryName };
