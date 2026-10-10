# Setup

Runs the full toju stack on your machine: Postgres, API, web UI, and the agent demo.
Tested on macOS (Apple Silicon). Testnets only.

## 1. Prerequisites

- **Docker Desktop**, running
- **Node.js 20 or newer** (any version; the API's own Node 22 is downloaded for you)
- **Google Chrome** (only for recording the video)
- A free **Pinata** account, for IPFS pinning

## 2. Install

```bash
git clone https://github.com/aspiringsdgs/Mesh-Observe-SocialCalc.git
cd Mesh-Observe-SocialCalc/demo
./setup.sh
```

`setup.sh` is safe to re-run. It installs dependencies, starts Postgres in Docker, creates the
schema, builds the API, and generates throwaway **testnet** wallets and env files. At the end it
prints the two addresses you need to fund.

## 3. Credentials and test funds

| What | Where | How |
|---|---|---|
| Pinata JWT | `afara/server/.env` → `PINATA_JWT` | app.pinata.cloud → API Keys → New Key (admin) |
| Pinata gateway | `afara/server/.env` → `PINATA_GATEWAY` | app.pinata.cloud → Gateways. Format: `https://<name>.mypinata.cloud` |
| Testnet SOL | the "Solana TESTNET SOL" address printed by setup | faucet.solana.com. **Choose Testnet, not Devnet**: the toju program is only deployed on testnet |
| Test USDC | the "Base Sepolia USDC" address printed by setup | faucet.circle.com → Base Sepolia |
| LLM key *(optional)* | `demo/agent/.env` → `GROQ_API_KEY`, `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` | Needed only for the LangChain agent. Groq has a free tier |

To see the addresses again: `node scripts/init-env.mjs` (it never overwrites anything).
A fraction of a SOL and 1 USDC are plenty; each upload in the demo costs well under a cent.

## 4. Run

```bash
./start.sh      # API on :5040, UI on :3000
```

Open http://localhost:3000, connect a Solana wallet set to **Testnet**, and upload a file.

Agent, by hand:

```bash
cd agent
node balance.mjs                                  # agent wallet + USDC balance
node direct.mjs ./test-data/sample.txt 30         # SDK only, no LLM
npx tsx langchain-agent.ts "Store ./test-data/sample.txt on IPFS for 30 days."
```

Storing the same file twice returns `409` (already stored). Change the file to store again.

## 5. Record the demo video

```bash
node record.mjs                  # full video -> out/toju-demo.mp4, screenshots -> screenshots/
node record.mjs --scene web      # Solana part only
node record.mjs --scene agent    # agent part only
node record.mjs --headed         # watch it in a visible Chrome window
node record.mjs --partial        # record even if something is missing (output is labelled DRYRUN)
```

It prints a preflight table first and refuses to make a full recording while anything is missing.
The recording connects a scripted testnet wallet instead of a browser extension; see the README.

## 6. Stop

```bash
./stop.sh
```

## Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `Docker is not running` | Start Docker Desktop, then re-run |
| Preflight shows `MISS testnet SOL` but you used the faucet | The SOL went to Devnet. Request again with **Testnet** selected |
| Agent gets `402` twice and "Upload failed with status 402" | The agent wallet has no USDC on Base Sepolia |
| `Error uploading file` / upload fails right after paying | `PINATA_JWT` is missing or wrong. Fix `afara/server/.env`, then `./start.sh` |
| `model_not_found` from the LangChain agent | Set `AGENT_MODEL` in `demo/agent/.env` to a model your key can use, e.g. `groq:openai/gpt-oss-120b` |
| API exits with `Cannot find module ... sentry_cpu_profiler` | It was started with system Node 25+. Use `./start.sh`, which uses Node 22 |
| Quotes fail with "Unable to get SOL price" | The API was started without `--import ./local-pyth.mjs`. Use `./start.sh` |
| History page is empty after an upload | Hard-refresh; check `demo/logs/server.log` for a `GET /upload/history` line |
| Port 3000 or 5040 already in use | `./stop.sh`, or stop whatever else holds the port |

Logs: `demo/logs/server.log` and `demo/logs/ui.log`.

## What is on your machine afterwards

- Docker containers `toju-pg` and `toju-neon-proxy`, network `toju-net`
- `.tools/node22/` (a private Node 22)
- `demo/wallets.local.json`, `afara/server/.env`, `afara/ui/.env.local`, `demo/agent/.env`:
  git-ignored, contain testnet keys and your Pinata/LLM credentials. Never commit them and never
  send mainnet funds to these wallets.

To remove everything: `./stop.sh && docker rm toju-pg toju-neon-proxy && docker network rm toju-net`,
then delete the folder.
