/**
 * JSON Schema for Job Hunter second-pass enrichment (verify + expand notes against listing text).
 */

const ENRICH_BATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rows: {
      type: 'array',
      description: 'One object per input row, same order as input or keyed by originalIdx',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          originalIdx: {
            type: 'integer',
            description: '0-based index of the row in the input batch'
          },
          co: { type: 'string' },
          role: { type: 'string' },
          loc: { type: 'string' },
          notes: {
            type: 'string',
            description:
              'Rich text for resume/cover letter: responsibilities, requirements, skills/tools, work arrangement, comp if stated, how to apply'
          },
          url: { type: 'string' },
          deadline: { type: 'string' },
          yoe: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['originalIdx', 'co', 'role', 'loc', 'notes', 'url', 'deadline', 'yoe', 'tags']
      }
    }
  },
  required: ['rows']
};

module.exports = { ENRICH_BATCH_JSON_SCHEMA };
