#!/bin/bash
# Starts the whole local toju stack: Postgres + Neon proxy (Docker), API (:5040), UI (:3000).
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
NODE22="$ROOT/.tools/node22/bin/node"
mkdir -p "$ROOT/demo/logs"

docker info >/dev/null 2>&1 || { echo "Docker is not running - start Docker Desktop first"; exit 1; }
docker start toju-pg toju-neon-proxy >/dev/null
echo "db      up (postgres :55432, neon http proxy :4444)"

lsof -ti tcp:5040 | xargs kill 2>/dev/null || true
lsof -ti tcp:3000 | xargs kill 2>/dev/null || true
sleep 1

# The API needs Node <= 24 (@sentry/profiling-node has no Node 26 binary), hence the local Node 22.
(cd "$ROOT/afara/server" && nohup "$NODE22" --import ./local-neon.mjs --import ./local-pyth.mjs dist/index.js > "$ROOT/demo/logs/server.log" 2>&1 &)
(cd "$ROOT/afara/ui" && nohup npx vite --port 3000 --strictPort > "$ROOT/demo/logs/ui.log" 2>&1 &)

for i in $(seq 1 30); do curl -s -o /dev/null localhost:5040/health && curl -s -o /dev/null localhost:3000 && break; sleep 1; done
echo "api     $(curl -s localhost:5040/health)"
echo "ui      http://localhost:3000"
echo "logs    demo/logs/server.log, demo/logs/ui.log"
