/**
 * JSON Schema for Job CRM enhance / full reconciliation patch.
 * Used with Anthropic structured outputs and OpenAI json_schema response_format.
 *
 * All properties are required in-schema; use empty string or empty tags array
 * when a field cannot be verified — server strips those before applying.
 */

const JOBS_CRM_PATCH_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    co: {
      type: 'string',
      description:
        'Employer or brand name for this vacancy from listing/snippets. Empty string if not verifiable.'
    },
    role: {
      type: 'string',
      description: 'Job title exactly as in the posting when possible. Empty string if not verifiable.'
    },
    loc: {
      type: 'string',
      description: 'Location: city/state, Remote, Hybrid, etc. Empty string if not verifiable.'
    },
    notes: {
      type: 'string',
      description:
        'Concise summary: scope, requirements, apply instructions from context only. Empty string if insufficient context.'
    },
    url: {
      type: 'string',
      description:
        'Single job listing URL copied exactly from allowed context. Empty string if none verified.'
    },
    deadline: {
      type: 'string',
      description: 'Application deadline or Rolling. Empty string if unknown.'
    },
    yoe: {
      type: 'string',
      description: 'Years of experience required (e.g. 0–2, 3+). Empty string if not stated.'
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description:
        '3–12 short tags from the role. Empty array if tags cannot be grounded in context.'
    }
  },
  required: ['co', 'role', 'loc', 'notes', 'url', 'deadline', 'yoe', 'tags']
};

/**
 * Remove empty placeholders so we do not overwrite CRM with blanks.
 * Safe for both schema-shaped responses and legacy partial JSON.
 */
function stripEmptyJobCrmPatch(obj) {
  if (!obj || typeof obj !== 'object') return {};
  const out = {};
  const strKeys = ['co', 'role', 'loc', 'notes', 'url', 'deadline', 'yoe'];
  for (let i = 0; i < strKeys.length; i++) {
    const k = strKeys[i];
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') {
      out[k] = v.trim();
    }
  }
  if (Array.isArray(obj.tags) && obj.tags.length > 0) {
    out.tags = obj.tags
      .map(function (s) {
        return String(s).trim();
      })
      .filter(Boolean)
      .slice(0, 25);
  }
  return out;
}

module.exports = {
  JOBS_CRM_PATCH_JSON_SCHEMA,
  stripEmptyJobCrmPatch
};
