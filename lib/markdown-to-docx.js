/**
 * Convert a Markdown string to a Word .docx Buffer using the `docx` package.
 * Handles: H1–H3 headings, bold/italic inline, bullet lists, horizontal rules,
 * and plain paragraphs. Sufficient for resume-style documents.
 */

const {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle
} = require('docx');

function stripInline(text) {
  return text
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/___(.+?)___/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.+?)_/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/**
 * Parse inline markdown into an array of TextRun objects.
 * Handles bold (**text**), italic (*text*), and bold-italic (***text***).
 */
function parseInline(raw) {
  const runs = [];
  // Combined regex for bold-italic, bold, italic
  const re = /(\*\*\*|___|\*\*|__|\*|_)(.+?)\1/g;
  let last = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) {
      runs.push(new TextRun({ text: raw.slice(last, m.index) }));
    }
    const marker = m[1];
    const inner = m[2];
    const bold = marker === '**' || marker === '__' || marker === '***' || marker === '___';
    const italic = marker === '*' || marker === '_' || marker === '***' || marker === '___';
    runs.push(new TextRun({ text: inner, bold, italics: italic }));
    last = re.lastIndex;
  }
  if (last < raw.length) {
    runs.push(new TextRun({ text: raw.slice(last) }));
  }
  if (runs.length === 0) runs.push(new TextRun({ text: '' }));
  return runs;
}

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4
};

function buildParagraphs(markdown) {
  const lines = String(markdown || '').split('\n');
  const paragraphs = [];

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trimEnd();

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(line.trim())) {
      paragraphs.push(
        new Paragraph({
          border: {
            bottom: { color: 'AAAAAA', style: BorderStyle.SINGLE, size: 6, space: 1 }
          },
          children: [new TextRun({ text: '' })]
        })
      );
      continue;
    }

    // ATX heading: # text
    const headingMatch = /^(#{1,4})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = Math.min(headingMatch[1].length, 4);
      paragraphs.push(
        new Paragraph({
          heading: HEADING_MAP[level],
          children: parseInline(headingMatch[2])
        })
      );
      continue;
    }

    // Bullet: - or * or +
    const bulletMatch = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bulletMatch) {
      const depth = Math.floor(bulletMatch[1].length / 2);
      paragraphs.push(
        new Paragraph({
          bullet: { level: Math.min(depth, 8) },
          children: parseInline(bulletMatch[2])
        })
      );
      continue;
    }

    // Numbered list: 1. text
    const numMatch = /^(\s*)\d+[.)]\s+(.*)$/.exec(line);
    if (numMatch) {
      const depth = Math.floor(numMatch[1].length / 2);
      paragraphs.push(
        new Paragraph({
          numbering: { reference: 'numbering', level: Math.min(depth, 8) },
          children: parseInline(numMatch[2])
        })
      );
      continue;
    }

    // Blank line → empty paragraph (small spacer)
    if (!line.trim()) {
      paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      continue;
    }

    // Regular paragraph
    paragraphs.push(
      new Paragraph({
        children: parseInline(line.replace(/^>\s?/, '').trimStart())
      })
    );
  }

  return paragraphs;
}

/**
 * @param {string} markdown
 * @returns {Promise<Buffer>}
 */
async function markdownToDocxBuffer(markdown) {
  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'numbering',
          levels: [0, 1, 2, 3].map(function (level) {
            return {
              level,
              format: 'decimal',
              text: '%' + (level + 1) + '.',
              alignment: AlignmentType.START
            };
          })
        }
      ]
    },
    sections: [
      {
        children: buildParagraphs(markdown)
      }
    ]
  });

  return Packer.toBuffer(doc);
}

module.exports = { markdownToDocxBuffer };
