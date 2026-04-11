const { Document, Packer, Paragraph, TextRun } = require('docx');

/**
 * @param {string} text
 * @returns {Promise<Buffer>}
 */
async function plainTextToDocxBuffer(text) {
  const lines = String(text || '').split('\n');
  const children = lines.map(function (line) {
    return new Paragraph({
      children: [
        new TextRun({
          text: line,
          font: 'Calibri'
        })
      ]
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}

module.exports = { plainTextToDocxBuffer };
