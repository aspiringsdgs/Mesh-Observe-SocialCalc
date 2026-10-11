#!/bin/bash
lsof -ti tcp:5040 | xargs kill 2>/dev/null; lsof -ti tcp:3000 | xargs kill 2>/dev/null; lsof -ti tcp:5050 | xargs kill 2>/dev/null
docker stop toju-pg toju-neon-proxy >/dev/null 2>&1
echo "stopped"
