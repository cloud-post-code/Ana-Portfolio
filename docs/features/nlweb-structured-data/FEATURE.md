# Feature: NLWeb-ready structured data

## Goal
Make the portfolio site consumable by NLWeb (and AI agents generally) by publishing
Schema.org structured data for its content.

## Behavior
1. The homepage (`/`) embeds JSON-LD (`<script type="application/ld+json">`) describing:
   - Ana Machuca as a `Person` (marketing/branding professional),
   - the site as a `WebSite`,
   - an `ItemList` of her projects and work experiences.
2. Each detail page (`/project/:slug`, `/experience/:slug`) embeds a `CreativeWork`
   JSON-LD object with name, description, url, and author.
3. A new endpoint `GET /schema.json` returns the full content catalog as an array of
   Schema.org JSON objects with absolute URLs. This is the ingestion feed for NLWeb's
   data loader (and works identically in production on Railway).

## Non-goals
- Deploying NLWeb itself to Railway (separate service; requires user approval).
- Regenerating the legacy static `experience-*.html` / `project-*.html` files.

## Data source
Existing CMS store (`lib/cms-store.js`): Postgres in production, `data/*.json` locally.
No schema changes.
