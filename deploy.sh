#!/bin/bash
# TMS Deployment Script
# Usage: ./deploy.sh
# Run on server: 195.142.150.170
set -e

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${GREEN}[TMS]${NC} $1"; }
warn() { echo -e "${YELLOW}[TMS]${NC} $1"; }
err()  { echo -e "${RED}[TMS]${NC} $1"; exit 1; }

log "═══════════════════════════════════════════════"
log " TMS — Traceability Management System v1.0"
log " Samsun Bozankaya Projesi"
log "═══════════════════════════════════════════════"

# ── Check prerequisites ──────────────────────────────
command -v node  >/dev/null || err "Node.js not found. Install: https://nodejs.org"
command -v npm   >/dev/null || err "npm not found"
command -v psql  >/dev/null || err "PostgreSQL client not found"

NODE_VER=$(node -v | cut -c2- | cut -d. -f1)
[ "$NODE_VER" -lt 18 ] && err "Node.js 18+ required (found: $(node -v))"
log "Node.js $(node -v) ✓"

# ── Environment setup ────────────────────────────────
if [ ! -f backend/.env ]; then
  warn "backend/.env not found — creating from example"
  cp backend/.env.example backend/.env
  warn "EDIT backend/.env before continuing!"
  warn "  DATABASE_URL=postgresql://USER:PASS@localhost:5432/tms"
  warn "  JWT_SECRET=your-long-random-secret"
  read -p "Press Enter after editing .env..."
fi

source backend/.env 2>/dev/null || true
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/tms}"

# ── Database ─────────────────────────────────────────
log "Setting up database..."
DB_NAME=$(echo "$DB_URL" | sed 's/.*\///')
DB_BASE=$(echo "$DB_URL" | sed "s/${DB_NAME}$/postgres/")

# Create DB if not exists
psql "$DB_BASE" -c "CREATE DATABASE $DB_NAME;" 2>/dev/null && log "Database '$DB_NAME' created" || warn "Database '$DB_NAME' already exists"

# ── Backend ──────────────────────────────────────────
log "Installing backend dependencies..."
cd backend
npm install --production
log "Running migrations..."
node src/db/migrate.js
log "Seeding database..."
node src/db/seed.js
cd ..

# ── Frontend ─────────────────────────────────────────
log "Installing frontend dependencies..."
cd frontend
npm install
log "Building frontend..."
VITE_API_URL=http://localhost:3000 npm run build
cd ..

# Copy built frontend to backend static dir
mkdir -p backend/public
cp -r frontend/dist/* backend/public/
log "Frontend built and copied to backend/public ✓"

# Update express to serve static frontend
cat >> backend/src/index.js.patch << 'EOF'
// Serve React app for all non-API routes (add before error handler)
const path = require('path');
app.use(express.static(path.join(__dirname, '../public')));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
  }
});
EOF

# ── PM2 / Process Manager ────────────────────────────
if command -v pm2 >/dev/null; then
  log "Starting with PM2..."
  pm2 stop tms 2>/dev/null || true
  pm2 start backend/src/index.js --name tms --env production
  pm2 save
  pm2 startup 2>/dev/null || true
  log "TMS running as PM2 process 'tms'"
else
  warn "PM2 not found. Install: npm install -g pm2"
  warn "Starting with node (not persistent)..."
  cd backend && NODE_ENV=production node src/index.js &
  log "PID: $!"
fi

log ""
log "═══════════════════════════════════════════════"
log " ✓ TMS deployed successfully!"
log ""
log " API:      http://localhost:3000/api"
log " App:      http://localhost:3000"
log " Health:   http://localhost:3000/health"
log ""
log " Default login:"
log "   Admin:    admin@tms.com    / tms2026"
log "   Operator: operator@tms.com / tms2026"
log "   QC:       qc@tms.com       / tms2026"
log "═══════════════════════════════════════════════"
