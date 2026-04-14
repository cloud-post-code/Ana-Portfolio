/**
 * Zip cover letter (.docx) + tailored resume (.docx) for a single download.
 */

/**
 * @param {{ coverDocxBuffer: Buffer, tailoredResumeDocxBuffer: Buffer, slug: string }} opts
 * @returns {Promise<Buffer>}
 */
async function buildApplicationPackZip(opts) {
  const JSZip = require('jszip');
  const zip = new JSZip();
  const slug = String(opts.slug || 'company').replace(/[^\w-]+/g, '-').slice(0, 48) || 'company';

  zip.file(`Cover-letter-${slug}.docx`, opts.coverDocxBuffer);
  zip.file(`Tailored-Resume-${slug}.docx`, opts.tailoredResumeDocxBuffer);

  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
}

module.exports = { buildApplicationPackZip };
