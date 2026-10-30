#!/usr/bin/env bash
# ==========================================================
#  🎬 Animedy — Automated Environment Setup Script
#  One-click setup for teammates & contributors
# ==========================================================

set -e

# Colors for terminal output
BOLD="\033[1m"
GREEN="\033[0;32m"
CYAN="\033[0;36m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo -e "${BOLD}${CYAN}==========================================================${NC}"
echo -e "${BOLD}${CYAN}  🎬 Setting up Animedy Development Environment...${NC}"
echo -e "${BOLD}${CYAN}==========================================================${NC}\n"

# 1. Check Node.js and npm
echo -e "${BOLD}▶ Step 1: Checking Node.js and npm...${NC}"
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Error: Node.js is not installed.${NC}"
  echo -e "  Please install Node.js (v18 or higher recommended): https://nodejs.org"
  exit 1
fi

if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ Error: npm is not installed.${NC}"
  exit 1
fi

NODE_VER=$(node -v)
NPM_VER=$(npm -v)
echo -e "  ${GREEN}✓ Found Node.js: ${NODE_VER}${NC}"
echo -e "  ${GREEN}✓ Found npm:     v${NPM_VER}${NC}\n"

# 2. Setup Environment Variables (.env)
echo -e "${BOLD}▶ Step 2: Setting up environment variables...${NC}"
if [ ! -f "$DIR/.env" ]; then
  if [ -f "$DIR/.env.example" ]; then
    cp "$DIR/.env.example" "$DIR/.env"
    echo -e "  ${GREEN}✓ Created .env from .env.example${NC}"
  else
    echo -e "  ${YELLOW}! Warning: .env.example not found, skipping .env creation.${NC}"
  fi
else
  echo -e "  ${CYAN}ℹ .env file already exists. Preserving existing settings.${NC}"
fi
echo ""

# 3. Install Root / Backend Dependencies
echo -e "${BOLD}▶ Step 3: Installing backend & root dependencies...${NC}"
npm install
echo -e "  ${GREEN}✓ Root dependencies installed successfully.${NC}\n"

# 4. Install Frontend UI Dependencies
echo -e "${BOLD}▶ Step 4: Installing frontend UI dependencies (Svelte 5 / Vite)...${NC}"
if [ -d "$DIR/src/ui_test" ]; then
  (cd "$DIR/src/ui_test" && npm install)
  echo -e "  ${GREEN}✓ Frontend UI dependencies installed successfully.${NC}\n"
else
  echo -e "${RED}✗ Error: src/ui_test folder not found.${NC}"
  exit 1
fi

# 5. Make helper scripts executable
echo -e "${BOLD}▶ Step 5: Setting executable permissions on helper scripts...${NC}"
chmod +x "$DIR/run.sh" 2>/dev/null || true
chmod +x "$DIR/setup.sh" 2>/dev/null || true
echo -e "  ${GREEN}✓ Script permissions configured.${NC}\n"

# 6. Verification
echo -e "${BOLD}▶ Step 6: Verifying frontend types...${NC}"
(cd "$DIR/src/ui_test" && npm run check)
echo -e "  ${GREEN}✓ Type checks passed with zero errors.${NC}\n"

echo -e "${BOLD}${GREEN}==========================================================${NC}"
echo -e "${BOLD}${GREEN}  ✨ Setup Complete! Animedy is ready to run.            ${NC}"
echo -e "${BOLD}${GREEN}==========================================================${NC}"
echo -e "${BOLD}To start developing:${NC}"
echo -e "  ${CYAN}./run.sh${NC}                  → Starts both Backend (3000) & Frontend (5173)"
echo -e "  ${CYAN}cd src/ui_test && npm run dev${NC} → Starts Frontend only"
echo -e ""
echo -e "${BOLD}Local URLs:${NC}"
echo -e "  🚀 Frontend : ${CYAN}http://localhost:5173${NC}"
echo -e "  ⚙️  Backend  : ${CYAN}http://localhost:3000${NC}"
echo -e "  📖 Swagger  : ${CYAN}http://localhost:3000/docs${NC}"
echo -e "${BOLD}${GREEN}==========================================================${NC}\n"
