#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Smart Household Tracker — Local Setup Helper
# Run once: bash scripts/setup-local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/apps/web"
WORKER="$ROOT/apps/api-worker"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[setup]${NC} $1"; }
warn()  { echo -e "${YELLOW}[warn] ${NC} $1"; }
error() { echo -e "${RED}[error]${NC} $1"; }

echo ""
echo "  Smart Household Tracker — Local Dev Setup"
echo "  ──────────────────────────────────────────"
echo ""

# ── 1. Node check ────────────────────────────────────────────────────────────
NODE_VER=$(node -v 2>/dev/null || echo "not found")
if [[ "$NODE_VER" == "not found" ]]; then
  error "Node.js not found. Install v18+ from https://nodejs.org"
  exit 1
fi
info "Node $NODE_VER detected"

# ── 2. Install dependencies ───────────────────────────────────────────────────
info "Installing npm workspaces dependencies..."
cd "$ROOT" && npm install

# ── 3. Web .env.local ─────────────────────────────────────────────────────────
if [ -f "$WEB/.env.local" ]; then
  warn ".env.local already exists — skipping (edit it manually if needed)"
else
  cp "$WEB/.env.example" "$WEB/.env.local"
  info "Created apps/web/.env.local from template"
  warn "  ★ Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY"
  warn "  ★ Leave VITE_API_BASE_URL empty for local dev (Vite proxy handles it)"
fi

# ── 4. Worker .dev.vars ───────────────────────────────────────────────────────
if [ -f "$WORKER/.dev.vars" ]; then
  warn ".dev.vars already exists — skipping"
else
  cp "$WORKER/.dev.vars.example" "$WORKER/.dev.vars"
  info "Created apps/api-worker/.dev.vars from template"
  warn "  ★ Fill in SUPABASE_JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
fi

# ── 5. Local D1 migrations ────────────────────────────────────────────────────
info "Applying D1 migrations locally..."
cd "$WORKER" && npx wrangler d1 migrations apply sht-db --local --yes 2>&1 \
  || warn "Migration step failed — make sure .dev.vars is filled first, then run: npm run migrate:local"

echo ""
info "Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Fill in apps/web/.env.local          (Supabase URL + anon key)"
echo "  2. Fill in apps/api-worker/.dev.vars    (Supabase JWT secret + service key)"
echo "  3. Run:  npm run dev"
echo "     → Frontend: http://localhost:3000"
echo "     → Worker:   http://localhost:8787"
echo ""

