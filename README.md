# Smart Household Tracker 🏠

A mobile-first household management app for Indian families — built on Cloudflare's serverless stack with Supabase Auth.

**Stack:** React + TypeScript · Cloudflare Pages · Cloudflare Workers · Cloudflare D1 · Supabase Auth

---

## ⚡ Run Locally (5 minutes)

> Full guide → **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

```bash
# 1. Install dependencies
npm install

# 2. Copy env templates
cp apps/web/.env.example          apps/web/.env.local
cp apps/api-worker/.dev.vars.example  apps/api-worker/.dev.vars

# 3. Fill in Supabase keys in both files (see docs/LOCAL_SETUP.md)

# 4. Create local database
npm run migrate:local

# 5. Start
npm run dev
#   Frontend → http://localhost:3000
#   Worker   → http://localhost:8787
```

---

## 🚀 One-Time Setup (Done Entirely in Browsers — No Local Machine Required)

Everything deploys automatically via **GitHub Actions** on every push to `main`.  
You only need to configure the accounts and paste secrets once.

---

### Step 1 — Fork / Push to GitHub

Push this repository to your GitHub account.

---

### Step 2 — Create a Supabase Project

1. Sign up at [supabase.com](https://supabase.com) → **New Project**
2. Note down from **Project Settings → API**:
   - `Project URL`
   - `anon/public` key
   - `JWT Secret` (under **API → JWT Settings**)

---

### Step 3 — Create a Cloudflare Account & API Token

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Go to **My Profile → API Tokens → Create Token**
3. Use template: **Edit Cloudflare Workers** — then also add:
   - `Cloudflare Pages: Edit`
   - `D1: Edit`
   - `R2: Edit`
4. Note the token and your **Account ID** (visible on the right sidebar of the Cloudflare dashboard homepage)

---

### Step 4 — Create Cloudflare Resources

Run these **once** using Cloudflare's browser-based dashboard or **Wrangler in GitHub Actions**:

#### 4a — Create D1 Database

Go to **Cloudflare Dashboard → Storage & Databases → D1 → Create Database**
- Name: `sht-db`
- Copy the **Database ID**

#### 4b — Update `wrangler.toml` with the Database ID

Edit `apps/api-worker/wrangler.toml` in GitHub directly:
```toml
[[d1_databases]]
database_id = "PASTE_YOUR_DATABASE_ID_HERE"   # ← replace this line
```
Commit the change — this is the **only** file edit you need to make.

#### 4c — Create Supabase Storage Bucket (replaces R2 — free, no card needed)

1. Go to your Supabase project → **Storage** (left sidebar)
2. Click **New bucket**
   - Name: `household-documents`
   - Toggle **Public bucket**: **OFF** (keep private — access via signed URLs)
3. Click **Save**

That's it. No credit card. No Cloudflare R2 needed.

Also collect the **Service Role Key** from Supabase (needed in Step 5):
- Go to **Project Settings → API → service_role** key → copy it

#### 4d — Create Cloudflare Pages Project

Go to **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**
- Select your GitHub repo
- Project name: `sht-web`
- Build command: `npm run build --workspace=apps/web`
- Build output directory: `apps/web/dist`
- **Skip** adding env vars here — GitHub Actions injects them at build time

---

### Step 5 — Add GitHub Secrets

Go to your GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

Add all of these:

| Secret Name | Where to get it |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Step 3 above |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Dashboard sidebar |
| `SUPABASE_JWT_SECRET` | Supabase → Project Settings → API → JWT Settings |
| `SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role key |
| `VITE_SUPABASE_URL` | Same as `SUPABASE_URL` above |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon/public key |
| `VITE_API_BASE_URL` | `https://sht-api-worker.<your-subdomain>.workers.dev` |

> **Tip:** `VITE_API_BASE_URL` — you'll know the Worker URL after the **first deploy** succeeds. Re-run the workflow after adding it.

---

### Step 6 — Push to `main` → Everything Deploys Automatically 🎉

The GitHub Actions pipeline (`.github/workflows/deploy.yml`) will:

1. ✅ Run D1 migrations against the remote database
2. ✅ Deploy the API Worker to Cloudflare Workers
3. ✅ Set `SUPABASE_JWT_SECRET` as a Worker secret
4. ✅ Build the React frontend with your env vars
5. ✅ Deploy the frontend to Cloudflare Pages
6. ✅ Run smoke tests against both services

---

## 🔁 Workflow Overview

```
GitHub push to main
        │
        ▼
┌─────────────────────┐
│  migrate-db         │  Apply D1 migrations (remote)
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  deploy-worker      │  wrangler deploy + set secrets
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  deploy-frontend    │  vite build → cloudflare/pages-action
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│  smoke-test         │  curl /health + Pages URL
└─────────────────────┘
```

**Pull Requests** → `.github/workflows/preview.yml` — deploys isolated preview environment with unique URL per PR.

---

## 📁 Project Structure

```
smarthousholdtracker/
  apps/
    web/                  React + Vite frontend (→ Cloudflare Pages)
    api-worker/           Cloudflare Worker REST API (→ Cloudflare Workers)
  packages/
    shared-types/         Shared TypeScript types
    shared-validation/    Shared Zod schemas
  .github/
    workflows/
      deploy.yml          Production deploy (push to main)
      preview.yml         Preview deploy (pull requests)
  docs/
    PRD.md                Product Requirements Document
    MODULE_USAGE_FAMILY_SAMPLE.md  Family module guide with sample data
    TDD.md                Technical Design Document
```

---

## 🛠 Local Development

Full step-by-step guide with troubleshooting: **[docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

```bash
npm install
cp apps/web/.env.example apps/web/.env.local
cp apps/api-worker/.dev.vars.example apps/api-worker/.dev.vars
# fill in Supabase keys in both files
npm run migrate:local
npm run dev
#   Frontend: http://localhost:3000
#   Worker:   http://localhost:8787
```

---

## 📦 Key Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start frontend + worker dev servers |
| `npm run build` | Build both apps |
| `npm run typecheck` | Type-check both apps |
| `npm run migrate:local` | Apply D1 migrations locally |
| `npm run migrate:remote` | Apply D1 migrations to production D1 |
| `npm run deploy:worker` | Manually deploy Worker (needs `wrangler login`) |
