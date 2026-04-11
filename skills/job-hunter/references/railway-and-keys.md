# Claude (Anthropic) API key: local, Railway, and security

## Variable name

| Purpose | Environment variable |
|--------|-------------------------|
| Anthropic Claude API (Messages API, SDK) | **`ANTHROPIC_API_KEY`** |

This is the name the official [**@anthropic-ai/sdk**](https://www.npmjs.com/package/@anthropic-ai/sdk) and Anthropic docs expect. Do **not** use custom names like `CLAUDE_API_KEY` in code unless you map them yourself.

Get a key: [Anthropic Console](https://console.anthropic.com/) → API keys → Create key.

---

## Local development (where to put the key)

1. In the **project root** (same directory as `package.json`), create a file named **`.env`** (leading dot).
2. Add a single line (no quotes unless your shell requires them):

   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

3. **Never commit `.env`.** Your repo should list `.env` in **`.gitignore`** (already standard for Node apps).
4. In Node, load before your app reads `process.env` (e.g. at the top of `server.js`):

   ```js
   require('dotenv').config();
   ```

   Add dependency: `npm install dotenv` if not already present.

5. Use the key only via env in code:

   ```js
   const apiKey = process.env.ANTHROPIC_API_KEY;
   if (!apiKey) console.warn('ANTHROPIC_API_KEY is not set');
   ```

6. **Optional template for teammates:** commit **`.env.example`** (no secrets) with placeholders only:

   ```bash
   # Copy to .env and fill in. Never commit .env.
   ANTHROPIC_API_KEY=
   ```

---

## Railway (where to put the key)

Railway injects **environment variables** into your running service; you do **not** put the secret in the repo.

### Steps

1. Open [Railway](https://railway.app) and select your **project**.
2. Select the **service** that runs your app (e.g. the Node/Express service).
3. Open the **Variables** tab (or **Settings → Variables**, depending on UI version).
4. Click **New Variable** / **+ New Variable**.
5. **Variable name:** `ANTHROPIC_API_KEY`
6. **Value:** paste your full secret key (`sk-ant-api03-...`).
7. Save. Railway stores variables encrypted; they are **not** shown in full after saving in some views.
8. **Redeploy** the service if it already started before the variable existed (or use **Deploy → Redeploy**), so the process picks up the new env.

### Shared / production vs preview

- You can use **different** keys per Railway **environment** (e.g. production vs staging) if you create multiple environments and set variables per environment.
- Prefer **restricted** keys from Anthropic if you use separate keys per environment.

### Build vs runtime

- Variables marked available **at build time** vs **runtime** depend on Railway settings. For API keys used only when the server handles requests, **runtime** is enough.
- Do **not** print `ANTHROPIC_API_KEY` in build logs or `console.log` in production.

---

## Docker / Dockerfile

If you deploy with a `Dockerfile` and **do not** use Railway’s variable injection into the same container, pass at run time:

```bash
docker run -e ANTHROPIC_API_KEY=sk-ant-api03-... your-image
```

On Railway, you typically **only** set variables in the dashboard; the platform passes them into the container—no need to `ENV ANTHROPIC_API_KEY` in the Dockerfile (and avoid baking secrets into images).

---

## Security checklist

- Never commit keys to git, never paste keys into public issues or screenshots.
- Rotate keys in Anthropic Console if exposed.
- Restrict CORS and routes if you add HTTP endpoints that call Claude on behalf of users.

---

## Skill + Cursor note

This **skill** (markdown instructions) does not call the API by itself. **Cursor** uses its own model connection. Use **`ANTHROPIC_API_KEY`** when **you** add scripts or server routes in your repo that call the Anthropic API (e.g. job-search helper endpoint). Point those scripts at `process.env.ANTHROPIC_API_KEY` and configure the variable locally (`.env`) and on Railway (Variables) as above.
