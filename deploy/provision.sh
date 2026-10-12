#!/bin/bash
# Provisions an Ubuntu 24.04 host to serve toju-sol behind nginx. Run on the server, from the repo root:
#   DOMAIN=toju-solana.duckdns.org ./deploy/provision.sh
# Before a domain points at the host, serve it by IP instead:
#   SITE_URL=http://203.0.113.10 ./deploy/provision.sh
# Expects afara/server/.env to exist already (copy it over; it holds secrets and is not in git).
# If demo/agent/.env exists too (agent wallet key + LLM key), the SocialCalc agent is served at /agent/.
set -euo pipefail
DOMAIN="${DOMAIN:-}"
SITE_URL="${SITE_URL:-${DOMAIN:+https://$DOMAIN}}"
: "${SITE_URL:?set DOMAIN or SITE_URL}"
SERVER_NAME="${DOMAIN:-_}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
step() { printf '\n== %s\n' "$1"; }
[ -f afara/server/.env ] || { echo "afara/server/.env is missing"; exit 1; }
AGENT=0; [ -f demo/agent/.env ] && [ -d demo/socialcalc-agent ] && AGENT=1

step "swap (builds need more than 2 GB)"
if ! sudo swapon --show | grep -q /swapfile; then
  sudo fallocate -l 3G /swapfile && sudo chmod 600 /swapfile && sudo mkswap -q /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
fi

step "packages: docker, nginx, certbot, node 22"
export DEBIAN_FRONTEND=noninteractive
sudo apt-get update -qq
sudo apt-get install -y -qq docker.io nginx certbot python3-certbot-nginx ca-certificates curl >/dev/null
if ! node -v 2>/dev/null | grep -q '^v22'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - >/dev/null
  sudo apt-get install -y -qq nodejs >/dev/null
fi
node -v; docker --version

step "database (Postgres + Neon HTTP proxy, bound to localhost only)"
sudo docker network inspect toju-net >/dev/null 2>&1 || sudo docker network create toju-net >/dev/null
sudo docker inspect toju-pg >/dev/null 2>&1 || sudo docker run -d --restart unless-stopped --name toju-pg --network toju-net \
  -v toju-pgdata:/var/lib/postgresql/data -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=toju -p 127.0.0.1:55432:5432 postgres:17 >/dev/null
sudo docker inspect toju-neon-proxy >/dev/null 2>&1 || sudo docker run -d --restart unless-stopped --name toju-neon-proxy --network toju-net \
  -e PG_CONNECTION_STRING='postgres://postgres:postgres@toju-pg:5432/toju' -p 127.0.0.1:4444:4444 ghcr.io/timowilhelm/local-neon-http-proxy:main >/dev/null
until sudo docker exec toju-pg pg_isready -U postgres -d toju >/dev/null 2>&1; do sleep 1; done

step "dependencies"
(cd afara && npx -y pnpm@10.11.0 install --frozen-lockfile 2>&1 | tail -2)
if [ "$AGENT" = 1 ]; then
  (cd afara && npx -y pnpm@10.11.0 --filter @toju.network/x402 build 2>&1 | tail -1)
  (cd demo/socialcalc-agent && npm install --no-audit --no-fund 2>&1 | tail -1)
fi

step "schema"
if ! sudo docker exec toju-pg psql -U postgres -d toju -tAc "select to_regclass('public.config')" | grep -q config; then
  for f in afara/server/drizzle/*.sql; do
    sed 's/--> statement-breakpoint//g' "$f" | sudo docker exec -i toju-pg psql -q -U postgres -d toju >/dev/null 2>&1 || true
  done
fi
(cd afara/server && NODE_OPTIONS='--import ./local-neon.mjs' npx tsx scripts/seed.ts 2>&1 | grep -E '✅|❌' || true)
sudo docker exec -i toju-pg psql -q -v ON_ERROR_STOP=1 -U postgres -d toju < demo/db/local-fixups.sql 2>/dev/null

step "build API and UI"
(cd afara/server && npx tsc -b)
cat > afara/ui/.env.production.local <<ENV
VITE_API_URL=$SITE_URL/api
VITE_SOLANA_NETWORK=testnet
VITE_FILECOIN_NETWORK=calibration
ENV
[ "$AGENT" = 1 ] && echo "VITE_AGENT_URL=$SITE_URL" >> afara/ui/.env.production.local
(cd afara/ui && NODE_OPTIONS=--max-old-space-size=3072 npx vite build 2>&1 | tail -3)
sudo mkdir -p /var/www/toju && sudo rsync -a --delete afara/ui/dist/ /var/www/toju/

step "API service"
sudo tee /etc/systemd/system/toju-api.service >/dev/null <<UNIT
[Unit]
Description=toju API
After=network-online.target docker.service
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$ROOT/afara/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --import ./local-neon.mjs --import ./local-pyth.mjs dist/index.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable -q toju-api && sudo systemctl restart toju-api

AGENT_LOCATION=""
if [ "$AGENT" = 1 ]; then
  step "SocialCalc agent service"
  sudo tee /etc/systemd/system/toju-agent.service >/dev/null <<UNIT
[Unit]
Description=SocialCalc agent
After=network-online.target toju-api.service
Wants=network-online.target

[Service]
User=$USER
WorkingDirectory=$ROOT/demo/socialcalc-agent
Environment=NODE_ENV=production
Environment=TOJU_ENDPOINT=http://127.0.0.1:5040
ExecStart=/usr/bin/node server.mjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
  sudo systemctl daemon-reload && sudo systemctl enable -q toju-agent && sudo systemctl restart toju-agent
  # Runs are streamed as Server-Sent Events, so nginx must not buffer them.
  AGENT_LOCATION='
  location /agent/ {
    proxy_pass http://127.0.0.1:5050;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_buffering off;
    proxy_read_timeout 600s;
  }'
fi

step "nginx"
sudo tee /etc/nginx/sites-available/toju >/dev/null <<NGINX
server {
  listen 80;
  server_name $SERVER_NAME;
  root /var/www/toju;
  index index.html;
  client_max_body_size 100m;

  location /api/ {
    proxy_pass http://127.0.0.1:5040/;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$remote_addr;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_read_timeout 300s;
    proxy_request_buffering off;
  }
$AGENT_LOCATION
  location / { try_files \$uri \$uri/ /index.html; }
}
NGINX
sudo ln -sf /etc/nginx/sites-available/toju /etc/nginx/sites-enabled/toju && sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t 2>&1 | tail -1 && sudo systemctl reload nginx

sleep 4
echo; echo "api:  $(curl -s -m 10 http://127.0.0.1:5040/health)"
echo "site: $(curl -s -m 10 -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN:-localhost}" http://127.0.0.1/)"
[ "$AGENT" = 1 ] && echo "agent: $(curl -s -m 10 http://127.0.0.1/agent/info | cut -c1-90)"
if [ -n "$DOMAIN" ]; then
  echo "Next, once DNS for $DOMAIN points here:  sudo certbot --nginx -d $DOMAIN --redirect --agree-tos --register-unsafely-without-email -n"
else
  echo "Next, once a domain points here, re-run with DOMAIN=<domain> and then run certbot."
fi
