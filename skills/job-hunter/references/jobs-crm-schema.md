# `jobs-crm.json` job object schema

Use this when **adding jobs to the list** (portfolio admin Job CRM at `/admin#job-crm`).

## File location

- Default: project root `data/jobs-crm.json` (same repo as the portfolio site).

## One job object

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `id` | string | yes | `j` + integer, e.g. `j101`. Must be unique in the file. |
| `t` | string | yes | Always `"job"`. |
| `co` | string | yes | Company name. |
| `role` | string | yes | Job title. |
| `loc` | string | yes | e.g. `"Boston, MA"` or `"Remote"`. |
| `st` | string | yes | Status: `To Apply`, `Applied`, `Interview`, `Offer`, `Passed`, `To Reach Out`, `Messaged`, `Replied`, `Coffee Chat`, `Engaged`, `Research`, … |
| `pri` | string | yes | `High`, `Medium`, or `Low`. |
| `notes` | string | yes | Short summary (responsibilities, fit, years exp). |
| `url` | string | yes | Listing or search URL; use best canonical apply link when possible. |
| `tags` | string[] | yes | 2–4 labels, e.g. `["Digital","Agency","NYC"]`. |

## Example

```json
{
  "id": "j101",
  "t": "job",
  "co": "Example Co",
  "role": "Marketing Coordinator",
  "loc": "Boston, MA",
  "st": "To Apply",
  "pri": "Medium",
  "notes": "Entry-level; campaigns and social.",
  "url": "https://example.com/careers/job-id",
  "tags": ["Coordinator", "Campaigns", "Boston"]
}
```

## ID assignment

1. Read existing array; find all `id` values matching `^j(\\d+)$`.
2. Set new id to `j` + `(max number + 1)`.
3. If file missing or empty, start at `j1` (or continue from existing max).

## Deduping before append

Skip a candidate if **either**:
- same `url` as an existing job, or
- same normalized `(co + role + loc)` (trim, collapse spaces, case-insensitive).
