#!/usr/bin/env bash
# run.sh - Starts both Animedy backend (Hono) and frontend (Vite)

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Load .env if present
if [ -f "$DIR/.env" ]; then
  set -a
  source "$DIR/.env"
  set +a
fi

# Ensure node/npm are in PATH if running in an environment without them pre-loaded
if ! command -v npm &> /dev/null; then
  if [ -d "$HOME/.nvm/versions/node/v22.19.0/bin" ]; then
    export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH"
  elif [ -s "$HOME/.nvm/nvm.sh" ]; then
    export NVM_DIR="$HOME/.nvm"
    # shellcheck disable=SC1091
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  fi
fi

if ! command -v npm &> /dev/null; then
  echo "Error: npm is not found in PATH."
  exit 1
fi

echo "=========================================================="
echo "  🎬 Animedy — Continuous Anime Watching Platform"
echo "=========================================================="
echo "  Starting Backend API..."

# Start backend
npm run dev &
BACKEND_PID=$!

echo "  Starting Frontend UI..."
# Start frontend
(cd "$DIR/src/ui_test" && npm run dev) &
FRONTEND_PID=$!

cleanup() {
  echo ""
  echo "Shutting down Animedy servers..."
  kill "$FRONTEND_PID" 2>/dev/null || true
  kill "$BACKEND_PID" 2>/dev/null || true
  wait "$FRONTEND_PID" 2>/dev/null || true
  wait "$BACKEND_PID" 2>/dev/null || true
  echo "Stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

echo ""
echo "  🚀 Frontend : http://localhost:5173"
echo "  ⚙️  Backend  : http://localhost:3000"
echo "  📖 API Docs : http://localhost:3000/docs"
echo "=========================================================="
echo "  Press Ctrl + C to stop both servers."
echo "=========================================================="
echo ""

# Wait for both child processes
wait
