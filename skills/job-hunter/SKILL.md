---
name: job-hunter
description: >
  A comprehensive entry-level marketing job search skill that finds open roles, supports user-defined custom search queries, can append discovered roles to data/jobs-crm.json for the portfolio Job CRM, documents ANTHROPIC_API_KEY and Railway Variables for Claude API usage in code, identifies resume gaps, surfaces alumni connections, highlights Colombian-born professionals, and recommends people for coffee chats — all filterable by industry. Use this skill whenever the user asks about finding marketing jobs, entry-level roles, campaign jobs, internships, job searching, resume tips for marketing, networking for jobs, who to reach out to, coffee chats, alumni connections, people from Colombia in marketing, custom job searches, saving jobs to CRM, Anthropic API keys, or Railway environment variables. Trigger this skill broadly — if the user is job searching in ANY marketing context, this skill should activate. Also trigger when user asks to find roles in specific industries like fashion, beauty, tech, CPG, or media, or when they want to add jobs to jobs-crm.json.
---

# Job Hunter Skill

An AI-powered entry-level marketing job search assistant. Finds open roles, surfaces resume requirements, identifies alumni, flags Colombian-born professionals, and recommends coffee chat targets — all filterable by industry.

---

## Claude / Anthropic API key (for scripts & deployed apps)

This skill does **not** call Claude by itself; **Cursor** already uses an AI model. Use an **Anthropic API key** when you (or this agent) add **code** that calls the Claude API (e.g. Node script, Express route, batch job).

| Item | Value |
|------|--------|
| **Environment variable** | **`ANTHROPIC_API_KEY`** (required by the official Anthropic SDK) |
| **Local file** | Project root **`.env`**: one line `ANTHROPIC_API_KEY=sk-ant-api03-...` |
| **Git** | Never commit `.env`. Keep `.env` in `.gitignore`. Commit **`.env.example`** with an empty value as a template (see `job-hunter/.env.example`). |
| **Railway** | Service → **Variables** → add **`ANTHROPIC_API_KEY`** → paste secret → save → **redeploy** so the running container sees it. |
| **Node usage** | `require('dotenv').config()` then `process.env.ANTHROPIC_API_KEY` — never hardcode keys in source. |

**Full step-by-step (Railway, Docker notes, security):** `references/railway-and-keys.md`.

---

## Workflow Overview

When triggered, follow these steps **in order**, combining web search calls efficiently:

1. **Clarify (if needed)** — Confirm industry focus and location if not already stated; capture **custom search** input if the user provided it (see below).
2. **Find Jobs** — Search for entry-level marketing/campaign roles in target industry + city, **merging in custom search terms** when supplied.
3. **Optional: Add jobs to CRM** — If the user wants roles saved to the list, update `data/jobs-crm.json` (see **Persisting jobs to the Job CRM list**).
4. **Extract Resume Requirements** — From job listings, identify the most commonly required skills.
5. **Find Alumni** — Search LinkedIn for people at those companies from user's school(s).
6. **Find Colombian-Born Professionals** — Search for Colombians in those companies or industries.
7. **Recommend Coffee Chat Targets** — Compile a prioritized outreach list.
8. **Present Results** — Use the structured output format below.

---

## Custom search (user-provided queries)

Users may supply **their own search parameters** instead of or in addition to the default templates. Treat these as **mandatory constraints** for web search.

**Accept any of the following (ask only if nothing at all is stated):**

| Input | How to use it |
|-------|----------------|
| Free-text keywords | Use as the **primary subject** of queries (e.g. `"brand activation" "contract" marketing`). |
| Role titles | Quote or OR them: `("coordinator" OR "specialist") marketing`. |
| Location | Append to every query: city, state, `remote`, `hybrid`, or `"United States"`. |
| Site / board | Honor `site:linkedin.com/jobs`, `site:indeed.com`, `site:glassdoor.com`, Greenhouse, Lever, etc. |
| Exclusions | Add `-intern` `-unpaid` or user’s minus-phrases when they say “no X”. |
| Seniority | Map to `entry`, `junior`, `associate`, `0-2 years`, `early career` as given. |
| Time | Prefer recent postings: add `2025`, `2026`, or `posted` / `last week` style terms when relevant. |

**Rules:**

- Run **at least 2–4** distinct web searches that **explicitly include** the user’s keywords and constraints; vary wording so results are not redundant.
- **Do not replace** user terms with generic “entry level marketing” unless they ask for broader results.
- If the user gives **only** custom search (no industry), still run alumni / Colombian / coffee sections using **companies and cities** from the roles you found.

---

## Persisting jobs to the Job CRM list (`jobs-crm.json`)

When the user asks to **add jobs to the list**, **save to CRM**, **append to jobs-crm**, **put these in my tracker**, or similar — after you have verified job details (from search or from the user):

1. **Resolve path** — Prefer **`data/jobs-crm.json`** at the project root of the portfolio repo (the site with admin **Job CRM** at `/admin#job-crm`). If the workspace uses a different path, use the file the user specifies.
2. **Read** the existing JSON array (if missing, treat as `[]`).
3. **Build** one object per new role using the schema in **`references/jobs-crm-schema.md`** (`id`, `t`, `co`, `role`, `loc`, `st`, `pri`, `notes`, `url`, `tags`).
4. **Assign `id`** — Scan existing ids matching `j` + digits; new ids = `j` + (max number + 1). Never duplicate an `id`.
5. **Dedupe** — Do not append if an entry already exists with the **same `url`**, or the **same** normalized company + role + location (case-insensitive, trimmed).
6. **Defaults** — `t`: `"job"`. `st`: `"To Apply"` unless the user specifies otherwise. `pri`: ask or infer **High** / **Medium** / **Low** from fit; default **Medium** if unclear.
7. **Write** the full array back with stable JSON formatting (2-space indent). Prefer editing the file in the workspace when the agent can write files.
8. **Confirm** to the user: how many jobs **added**, how many **skipped** (duplicates), and the new **`id`** values.

If the agent **cannot** write files, output a **ready-to-paste JSON array snippet** of only the new objects and instruct the user to merge into `data/jobs-crm.json` manually.

---

## Step 1: Industry & Location Clarification

If the user hasn't specified, ask:
- Which industry? (Fashion, Beauty/Makeup, CPG, Tech, Media, Retail, Lifestyle, Luxury, Sports, other)
- Which city or remote?
- Any specific role type? (e.g., Social Media, Campaigns, Brand, Influencer, Email Marketing)

If already specified in context, skip asking and proceed directly.

If the user already provided **custom search** terms (keywords, sites, exclusions), **do not** override them — fold them into the queries in Step 2.

---

## Step 2: Find Open Jobs

Run **2–4 web searches** targeting entry-level marketing roles (or the user’s **custom search** subject). **Always** weave in custom keywords, locations, and `site:` filters when the user supplied them.

**Default query templates** (use when the user did not specify custom search, or combine with custom terms):

```
"entry level marketing coordinator [industry] [city] 2025 OR 2026"
"campaign marketing associate [industry] [city] site:linkedin.com OR site:indeed.com"
"[industry] brand marketing jobs [city] junior OR coordinator OR associate"
```

**For each role found, capture:**
- Job title
- Company name
- Location / Remote status
- Link to apply
- Key responsibilities (bullet summary)
- Required skills

Target **5–8 roles** by default, or the **exact count** the user or admin UI requested for the **📋 Open Roles** table (typically **1–25**), across a mix of company sizes (startup, mid-size, enterprise). For a **full scrape** of a single board, cap at what is reasonable and note truncation.

**After this step:** If the user asked to **add jobs to the list** / **save to CRM**, perform **Persisting jobs to the Job CRM list** for the roles you are recommending (or for all found roles if they asked to save everything).

---

## Step 3: Extract Resume Requirements

After collecting job listings, synthesize the **top 8–12 skills** that appear most frequently across all postings. Categorize them:

### Hard Skills
- Tools (e.g., HubSpot, Salesforce, Meta Ads Manager, Google Analytics, Canva, Adobe Creative Suite)
- Platforms (e.g., TikTok, Instagram, email platforms like Klaviyo or Mailchimp)
- Data (e.g., A/B testing, campaign reporting, UTM tracking)

### Soft Skills
- Project management, cross-functional collaboration, copywriting, trend awareness

### Certifications Worth Adding
- Google Analytics, HubSpot Marketing, Meta Blueprint, Hootsuite

Present as: ✅ (likely already have) vs. 🔲 (worth adding) — ask user which they have if unclear.

---

## Step 4: Find Alumni Connections

Search LinkedIn and web for people who:
- Went to the user's school(s) — infer from context (e.g., Hult International Business School)
- Now work in marketing at companies in the target industry
- Are in entry/mid-level roles (coordinator, manager, specialist, strategist)

Searches to run:
```
"Hult International Business School" marketing [industry] LinkedIn
site:linkedin.com "Hult" "marketing" "[company name]"
```

For each alumnus found, note:
- Name (if available)
- Company & role
- Graduation era (if findable)
- Why they're a relevant connection

---

## Step 5: Find Colombian-Born Professionals

Search for Colombian professionals in the target industry or at target companies. This is for cultural connection and warm outreach.

Searches to run:
```
"Colombia" OR "Colombian" marketing [industry] Boston OR [city] LinkedIn
site:linkedin.com "born in Colombia" OR "from Medellín" OR "from Bogotá" marketing
"[company]" Colombia marketing professional
```

For each person found:
- Name (if public)
- Current role & company
- Colombian connection (city, background if stated publicly)
- Why they're worth reaching out to

Keep this section respectful and focused on professional community connection.

---

## Step 6: Coffee Chat Outreach List

Compile a **ranked list of 5–8 people** to reach out to, prioritizing:

1. 🥇 **Alumni + Colombian** — Highest priority (shared identity AND school)
2. 🥈 **Alumni only** — Strong warm connection
3. 🥉 **Colombian only** — Cultural connection, likely warm
4. ⭐ **Relevant industry professional** — Cold but strategic

For each person, provide a **one-line reason** to reach out and a **sample opening message** (2–3 sentences, casual and genuine).

---

## Step 7: Output Format

Present everything in this structure:

---

### 🎯 [Industry] Marketing Jobs — [City]

#### 📋 Open Roles

Output **one** markdown pipe table whose columns match the portfolio **Job CRM** table (same field order as `/admin` → Job CRM). Copy the header row **exactly**:

| # | Company | Role | Yrs exp | Job details | Location | Deadline | Status | Priority | Tags | Listing |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | … | … | … | … | … | … | To Apply | Medium | … | https://… |

- **Yrs exp**: copy the exact phrase from the posting (`2+ years`, `Entry level`, etc.). Default if unknown: `—`.
- **Job details**: enough for resume + cover letter (responsibilities, requirements, skills/tools, work arrangement; comp only if stated). Use `; ` between ideas, no `|`. Default if unknown: `—`.
- **Deadline**: date, `Rolling`, or default `—` if unknown.
- **Status**: default `To Apply` for new leads.
- **Priority**: default `Medium` when unsure; `High`/`Low` when evidence supports it.
- **Tags**: 2–4 comma-separated labels; default `—` if unknown.
- **Listing**: the **Apply** link for this role—where the candidate starts or submits an application (employer ATS such as Greenhouse/Lever/Workday preferred when shown). Use a **single-requisition** URL, not a generic careers or “all jobs” home, not a search results URL. Full `https://…` only when verified in search/snippets; default `—` if unknown. Never invent URLs.

**Double-check before you ship the table:** (1) Each company, title, and location matches the snippet or listing you used. (2) Each URL is a **direct apply or single-job posting** for that vacancy—not a hub or search page. Prefer employer/ATS apply URLs over board wrappers when both appear. (3) Prefer URLs that appear in your search results. (4) Remove duplicate company+role+location rows and any thin guesses.

---

#### 📄 Resume Must-Haves
**Add or highlight these for [industry] marketing roles:**
- ✅ / 🔲 [Skill] — [Why it matters]

---

#### 🎓 Alumni to Connect With
- **[Name or "Marketing Coordinator"]** @ [Company] — [Note]

---

#### 🇨🇴 Colombian Professionals in the Industry
- **[Name]** — [Role] @ [Company] | [Connection note]

---

#### ☕ Coffee Chat Priority List
1. **[Name]** — [Why / Warm/Cold] — *"[Opening line]"*
2. ...

---

## Important Notes

- **Anthropic API**: Any automation that calls Claude must read **`process.env.ANTHROPIC_API_KEY`** (after `dotenv` in development). Configure the same variable on **Railway → Variables** for production. See **Claude / Anthropic API key** above and `references/railway-and-keys.md`.
- **Custom search** takes precedence over generic templates whenever the user has supplied their own keywords, sites, or constraints.
- **Job CRM file**: When updating `data/jobs-crm.json`, validate JSON and preserve existing entries; only append new deduped jobs.
- **Privacy**: Only surface publicly available information. Do not speculate on personal details.
- **Colombian connection**: Search based on publicly stated background, LinkedIn bios, or articles. Never assume ethnicity from name alone.
- **Alumni**: Prioritize Hult International Business School unless user specifies otherwise.
- **Industry focus**: Run the full workflow per industry requested. If multiple industries, run separate job searches but consolidate resume skills and people sections.
- **Tone**: Keep outreach messages warm, genuine, and brief — never copy-paste sounding.
- **Campaign focus**: When surfacing roles, prioritize those with "campaigns," "paid media," "influencer," "email," or "brand activation" in the description, as user is interested in campaigns specifically.
