// HTTP front for the SocialCalc agent. Streams each run as Server-Sent Events.
//   POST /agent/run {prompt}        -> text/event-stream of agent events
//   GET  /agent/info                -> wallet, balance, model
//   GET  /agent/runs                -> recent runs
//   GET  /agent/workbooks/:file     -> the workbook JSON the agent built
//   GET  /agent/ipfs/:cid/:file     -> the same file read back from the IPFS gateway
import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ENDPOINT, MODEL, WORKBOOKS_DIR, agentAddress, runAgent, safeWorkbookName, usdcBalance } from './agent.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.AGENT_PORT || 5050)
const RUNS_FILE = path.join(HERE, 'runs.json')
const MAX_RUNS_PER_HOUR = Number(process.env.AGENT_MAX_RUNS_PER_HOUR || 20) // per client IP

// The gateway host is not a secret; read it from the API's env so links match where files are pinned.
const GATEWAY = await fs.readFile(path.join(HERE, '../../afara/server/.env'), 'utf8')
  .then((env) => env.match(/^PINATA_GATEWAY="?([^"\n]+)"?/m)?.[1])
  .catch(() => null)
  .then((g) => (process.env.IPFS_GATEWAY || g || 'https://ipfs.io').replace(/\/$/, ''))

const readRuns = () => fs.readFile(RUNS_FILE, 'utf8').then(JSON.parse, () => [])
const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

let busy = false
const recent = new Map() // ip -> timestamps

const server = http.createServer(async (req, res) => {
  res.setHeader('access-control-allow-origin', '*')
  res.setHeader('access-control-allow-headers', 'content-type')
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  const url = new URL(req.url, 'http://x')
  const parts = url.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  if (parts[0] !== 'agent') return json(res, 404, { message: 'not found' })

  try {
    if (req.method === 'GET' && parts[1] === 'info')
      return json(res, 200, { wallet: agentAddress(), usdc: await usdcBalance().catch(() => null), model: MODEL, network: 'Base Sepolia', storageApi: ENDPOINT, gateway: GATEWAY, busy })

    if (req.method === 'GET' && parts[1] === 'runs') return json(res, 200, (await readRuns()).slice(0, 20))

    if (req.method === 'GET' && parts[1] === 'workbooks' && parts[2]) {
      const file = await fs.readFile(path.join(WORKBOOKS_DIR, safeWorkbookName(parts[2])), 'utf8').catch(() => null)
      return file ? json(res, 200, JSON.parse(file)) : json(res, 404, { message: 'workbook not found' })
    }

    if (req.method === 'GET' && parts[1] === 'ipfs' && /^baf[a-z0-9]{20,}$/.test(parts[2] || '') && parts[3]) {
      const source = `${GATEWAY}/ipfs/${parts[2]}/${encodeURIComponent(safeWorkbookName(parts[3]))}`
      const upstream = await fetch(source, { signal: AbortSignal.timeout(45_000) })
      if (!upstream.ok) return json(res, 502, { message: `gateway answered ${upstream.status}`, source })
      res.writeHead(200, { 'content-type': 'application/json', 'x-ipfs-source': source, 'access-control-expose-headers': 'x-ipfs-source' })
      return res.end(await upstream.text())
    }

    if (req.method === 'POST' && parts[1] === 'run') {
      let body = ''
      for await (const chunk of req) body += chunk
      const prompt = String(JSON.parse(body || '{}').prompt || '').trim().slice(0, 1500)
      if (!prompt) return json(res, 400, { message: 'prompt is required' })

      const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress
      const stamps = (recent.get(ip) || []).filter((t) => Date.now() - t < 3_600_000)
      if (stamps.length >= MAX_RUNS_PER_HOUR) return json(res, 429, { message: 'Too many runs from this address, try again later.' })
      if (busy) return json(res, 409, { message: 'The agent is busy with another request. Try again in a minute.' })
      recent.set(ip, [...stamps, Date.now()])
      busy = true

      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive', 'x-accel-buffering': 'no' })
      const send = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`)
      const beat = setInterval(() => res.write(': keep-alive\n\n'), 15_000)
      try {
        const balanceBefore = await usdcBalance().catch(() => null)
        const result = await runAgent(prompt, send)
        const balanceAfter = await usdcBalance().catch(() => null)
        send({ type: 'balance', before: balanceBefore, after: balanceAfter })
        const runs = await readRuns()
        runs.unshift({ at: new Date().toISOString(), runId: result.runId, prompt, file: result.file, steps: result.steps, stored: result.stored, payment: result.payment })
        await fs.writeFile(RUNS_FILE, JSON.stringify(runs.slice(0, 50), null, 2))
      } catch (err) {
        console.error('run failed:', err.message) // the client already received an "error" event
      } finally {
        clearInterval(beat)
        busy = false
        res.end()
      }
      return
    }
    json(res, 404, { message: 'not found' })
  } catch (err) {
    if (!res.headersSent) json(res, 500, { message: err.message })
    else res.end()
  }
})

server.listen(PORT, () => console.log(`socialcalc agent on http://localhost:${PORT}  model=${MODEL}  storage=${ENDPOINT}  gateway=${GATEWAY}`))
