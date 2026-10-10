#!/bin/bash
# One-time setup for the local toju stack. Safe to re-run.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
step() { printf '\n\033[1m== %s\033[0m\n' "$1"; }

command -v docker >/dev/null || { echo "Docker is required"; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker is not running - start Docker Desktop first"; exit 1; }
command -v node >/dev/null || { echo "Node.js >= 20 is required"; exit 1; }

step "Node 22 for the API (@sentry/profiling-node has no binary for Node 25+)"
if [ ! -x .tools/node22/bin/node ]; then
  mkdir -p .tools && cd .tools
  OS=$(uname -s | tr '[:upper:]' '[:lower:]'); ARCH=$(uname -m); [ "$ARCH" = "x86_64" ] && ARCH=x64; [ "$ARCH" = "aarch64" ] && ARCH=arm64
  V=$(curl -fsS https://nodejs.org/dist/index.json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).find(r=>r.version.startsWith("v22.")).version))')
  T="node-$V-$OS-$ARCH.tar.gz"
  curl -fsSLO "https://nodejs.org/dist/$V/$T"
  curl -fsS "https://nodejs.org/dist/$V/SHASUMS256.txt" | grep " $T\$" | shasum -a 256 -c -
  tar xzf "$T" && rm "$T" && ln -sfn "node-$V-$OS-$ARCH" node22
  cd "$ROOT"
fi
.tools/node22/bin/node -v

step "Install dependencies"
(cd afara && npx -y pnpm@10.11.0 install --frozen-lockfile)
(cd demo && npm install)
(cd afara && npx -y pnpm@10.11.0 --filter @toju.network/x402 build)   # agent SDK, used by demo/agent
(cd demo/agent && npm install)

step "Wallets and env files"
(cd demo && node scripts/init-env.mjs)

step "Postgres + Neon HTTP proxy (Docker)"
docker network inspect toju-net >/dev/null 2>&1 || docker network create toju-net >/dev/null
docker inspect toju-pg >/dev/null 2>&1 || docker run -d --name toju-pg --network toju-net \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=toju -p 55432:5432 postgres:17 >/dev/null
docker inspect toju-neon-proxy >/dev/null 2>&1 || docker run -d --name toju-neon-proxy --network toju-net \
  -e PG_CONNECTION_STRING='postgres://postgres:postgres@toju-pg:5432/toju' -p 4444:4444 \
  ghcr.io/timowilhelm/local-neon-http-proxy:main >/dev/null
docker start toju-pg toju-neon-proxy >/dev/null
until docker exec toju-pg pg_isready -U postgres -d toju >/dev/null 2>&1; do sleep 1; done

step "Database schema"
if docker exec toju-pg psql -U postgres -d toju -tAc "select to_regclass('public.config')" | grep -q config; then
  echo "schema already present"
else
  # upstream scripts/migrate.ts is a no-op on @neondatabase/serverless v1, so apply the SQL directly.
  # 0006 and 0008 contain statements Postgres rejects; local-fixups.sql covers what they meant to do.
  for f in afara/server/drizzle/*.sql; do
    sed 's/--> statement-breakpoint//g' "$f" | docker exec -i toju-pg psql -q -U postgres -d toju >/dev/null 2>&1 || true
    echo "ran $(basename "$f")"
  done
fi
(cd afara/server && NODE_OPTIONS='--import ./local-neon.mjs' npx tsx scripts/seed.ts 2>&1 | grep -E '✅|❌' || true)
docker exec -i toju-pg psql -q -v ON_ERROR_STOP=1 -U postgres -d toju < demo/db/local-fixups.sql

step "Build the API"
(cd afara/server && npx tsc -b)

printf '\n\033[1mSetup done.\033[0m Next: fund the two wallets above, add Pinata credentials, then  cd demo && ./start.sh\n'
