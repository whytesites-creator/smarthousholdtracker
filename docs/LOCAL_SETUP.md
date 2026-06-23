# Local Development Setup Guide

Run the full Smart Household Tracker stack on your own machine in under 10 minutes.

---

## Architecture in local mode

```
Browser  →  http://localhost:3000   (Vite dev server — React frontend)
               │
               │  /api/*  (Vite proxy — no CORS, no VITE_API_BASE_URL needed)
               ▼
         http://localhost:8787   (wrangler dev — Cloudflare Worker)
               │
               ├── D1 (local SQLite file — .wrangler/state/v3/d1/)
               └── Supabase (cloud — same project as production)
```

> **Key point:** Vite is already configured to proxy every `/api/` request to the local worker on port `8787`. You do **not** need a `VITE_API_BASE_URL` for local dev — just leave it blank.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 + | https://nodejs.org |
| npm | 9 + | bundled with Node |
| Git | any | https://git-scm.com |

Wrangler (`npx wrangler`) is installed automatically as a dev-dependency — no global install needed.

---

## Step 1 — Clone the repo

```bash
git clone https://github.com/whytesites-creator/smarthousholdtracker.git
cd smarthousholdtracker
```

---

## Step 2 — Install all dependencies

```bash
npm install
```

This installs both `apps/web` and `apps/api-worker` via npm workspaces in one command.

---

## Step 3 — Create `apps/web/.env.local`

```bash
cp apps/web/.env.example apps/web/.env.local
```

Open `apps/web/.env.local` and fill in the two Supabase values:

```dotenv
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co      # ← your Supabase project URL
VITE_SUPABASE_ANON_KEY=eyJhbGci...                       # ← anon/public key
VITE_API_BASE_URL=                                        # ← leave blank for local dev
```

**Where to find these values:**
1. Go to [supabase.com](https://supabase.com) → your project
2. Click **Project Settings** (gear icon) → **API**
3. Copy **Project URL** → `VITE_SUPABASE_URL`
4. Copy **anon / public** key → `VITE_SUPABASE_ANON_KEY`

---

## Step 4 — Create `apps/api-worker/.dev.vars`

```bash
cp apps/api-worker/.dev.vars.example apps/api-worker/.dev.vars
```

Open `apps/api-worker/.dev.vars` and fill in:

```dotenv
SUPABASE_JWT_SECRET=your-jwt-secret-here
SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...service-role-key...
ENVIRONMENT=development
ALLOWED_ORIGINS=http://localhost:3000
SUPABASE_STORAGE_BUCKET=household-documents
```

**Where to find these values:**
| Variable | Location in Supabase Dashboard |
|----------|-------------------------------|
| `SUPABASE_JWT_SECRET` | Project Settings → API → **JWT Settings** → JWT Secret |
| `SUPABASE_URL` | Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → **service_role** key |

> ⚠️ Never commit `.dev.vars` — it is in `.gitignore`.

---

## Step 5 — Apply D1 migrations locally

This creates a local SQLite database (no cloud access needed):

```bash
npm run migrate:local
```

You will see output like:
```
Migrations to apply:
  - 0001_auth_module.sql
  - 0002_expenses.sql
  ...
  - 0010_notifications.sql
✅  Applied 10 migration(s)
```

The local database is stored at `apps/api-worker/.wrangler/state/v3/d1/` (gitignored).

---

## Step 6 — Start both dev servers

```bash
npm run dev
```

This starts two processes in parallel:

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | React + Vite hot-reload |
| Worker | http://localhost:8787 | Cloudflare Worker (wrangler dev) |

Open **http://localhost:3000** in your browser.

---

## Step 7 — Register & create your first household

1. Go to http://localhost:3000/register
2. Sign up with any email
3. Check your email for the Supabase confirmation link — click it
4. Log in → you will land on the Dashboard
5. Click the household switcher → **Create new household** → enter a name → Save

---

## One-shot setup (alternative)

If you prefer a single command that does steps 2–5 automatically:

```bash
bash scripts/setup-local.sh
```

Then fill in the two env files and run `npm run dev`.

---

## Common issues and fixes

### "Missing VITE_SUPABASE_URL" error on startup

You haven't created `.env.local`. Run:
```bash
cp apps/web/.env.example apps/web/.env.local
# then fill in the values
```

### Worker returns 401 "Invalid or expired token"

Your `SUPABASE_JWT_SECRET` in `.dev.vars` is wrong or missing. Double-check it matches the **JWT Secret** from Supabase Project Settings → API → JWT Settings (not the anon key).

### Worker returns 403 "Access denied" on all requests

`ALLOWED_ORIGINS` in `.dev.vars` must include `http://localhost:3000`. It should already be set in the template.

### "No households" / dashboard shows empty

The D1 migrations haven't been applied, or you skipped creating a household. Run:
```bash
npm run migrate:local
```

### CORS errors in browser console

Make sure `ALLOWED_ORIGINS=http://localhost:3000` is in `apps/api-worker/.dev.vars`.

### Wrangler keeps asking to log in

For local dev you don't need to log into Cloudflare — `wrangler dev` runs entirely offline with a local SQLite file. If it asks to log in, press **Enter** to skip or use `wrangler dev --local`.

### Email confirmation not arriving

Check your Supabase project → **Authentication → Email Templates** — make sure the project is not on paused/inactive status. Also check the spam folder.

---

## Useful dev commands

```bash
# Start everything
npm run dev

# Type-check both apps without building
npm run typecheck

# Apply new DB migrations locally after pulling new code
npm run migrate:local

# Wipe and re-apply all local migrations (fresh start)
# WARNING: deletes all local data
rm -rf apps/api-worker/.wrangler/state
npm run migrate:local

# Build for production (verify before pushing)
npm run build
```

---

## File reference

```
smarthousholdtracker/
  apps/
    web/
      .env.example          ← template (committed)
      .env.local            ← your secrets (gitignored — create from example)
    api-worker/
      .dev.vars.example     ← template (committed)
      .dev.vars             ← your secrets (gitignored — create from example)
      wrangler.toml         ← Worker config (has [env.local] for dev)
      .wrangler/            ← local D1 SQLite files (gitignored)
  scripts/
    setup-local.sh          ← one-shot setup helper
```

---

## Environment variables: local vs production

| Variable | Local (`.env.local`) | Production (Cloudflare Pages) |
|----------|---------------------|-------------------------------|
| `VITE_SUPABASE_URL` | your Supabase URL | same |
| `VITE_SUPABASE_ANON_KEY` | your anon key | same |
| `VITE_API_BASE_URL` | **blank** (uses Vite proxy) | Worker URL |

| Variable | Local (`.dev.vars`) | Production (Worker secret) |
|----------|--------------------|-----------------------------|
| `SUPABASE_JWT_SECRET` | from Supabase dashboard | GitHub secret → auto-injected |
| `SUPABASE_URL` | from Supabase dashboard | GitHub secret |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase dashboard | GitHub secret |
| `ALLOWED_ORIGINS` | `http://localhost:3000` | `https://sht-web.pages.dev` |
| `ENVIRONMENT` | `development` | `production` |

