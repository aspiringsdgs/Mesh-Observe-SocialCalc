// Records the toju demo video with Playwright.
//
//   node record.mjs                 full demo (fails preflight if anything is missing)
//   node record.mjs --scene agent   only the AI-agent (x402) part
//   node record.mjs --scene web     only the Solana-testnet web app part
//   node record.mjs --partial       record whatever works today, labelled as a dry run
//
// Everything on screen is real: the browser drives the locally running UI + API, and the
// terminal scene streams the stdout of commands actually executed in demo/agent.
import { spawn, execFileSync } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import ffmpegPath from 'ffmpeg-static'
import { installDemoWallet } from './lib/wallet.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const AGENT_DIR = path.join(HERE, 'agent')
const OUT = path.join(HERE, 'out')
const UI = 'http://localhost:3000'
const API = 'http://localhost:5040'
const STAGE_PORT = 4173
const SIZE = { width: 1440, height: 900 }

const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const opt = (name, dflt) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : dflt)
const SCENE = opt('scene', 'all')
const PARTIAL = flag('partial')
const HEADED = flag('headed')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const readEnv = (file) =>
  Object.fromEntries(
    (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '')
      .split('\n')
      .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/))
      .filter(Boolean)
      .map((m) => [m[1], m[2].replace(/^(['"])(.*)\1$/, '$2')]),
  )

// ---------------------------------------------------------------- preflight
async function preflight() {
  const wallets = JSON.parse(fs.readFileSync(path.join(HERE, 'wallets.local.json'), 'utf8'))
  const serverEnv = readEnv(path.join(HERE, '../afara/server/.env'))
  const agentEnv = readEnv(path.join(AGENT_DIR, '.env'))
  const ok = async (url) => fetch(url).then((r) => r.ok).catch(() => false)

  const rpc = (method, params) =>
    fetch('https://api.testnet.solana.com', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }).then((r) => r.json())
  const sol = await rpc('getBalance', [wallets.solanaUser.publicKey])
    .then((j) => j.result.value / 1e9)
    .catch(() => null)

  let usdc = null
  try {
    const out = execFileSync('node', ['balance.mjs'], { cwd: AGENT_DIR, encoding: 'utf8' })
    usdc = Number(out.match(/USDC balance : ([\d.]+)/)?.[1])
  } catch {}

  const s = {
    wallets,
    api: await ok(`${API}/health`),
    ui: await ok(UI),
    pinata: !!serverEnv.PINATA_JWT && serverEnv.PINATA_JWT !== 'REPLACE_ME',
    gateway: serverEnv.PINATA_GATEWAY,
    sol,
    usdc,
    llm: !!(agentEnv.GROQ_API_KEY || agentEnv.ANTHROPIC_API_KEY || agentEnv.OPENAI_API_KEY),
  }
  s.webReady = s.api && s.ui && s.pinata && sol > 0.001
  s.agentReady = s.api && s.pinata && usdc > 0

  const mark = (b) => (b ? '  ok ' : ' MISS')
  console.log('preflight')
  console.log(`${mark(s.api)} local API            ${API}`)
  console.log(`${mark(s.ui)} local UI             ${UI}`)
  console.log(`${mark(s.pinata)} PINATA_JWT           afara/server/.env`)
  console.log(`${mark(sol > 0.001)} testnet SOL          ${wallets.solanaUser.publicKey}  (${sol} SOL)`)
  console.log(`${mark(usdc > 0)} Base Sepolia USDC    ${wallets.baseAgent.address}  (${usdc} USDC)`)
  console.log(`${s.llm ? '  ok ' : ' opt '} LLM API key          demo/agent/.env  ${s.llm ? '' : '(without it the agent scene uses the SDK directly, no LLM)'}`)
  return s
}

// ---------------------------------------------------------------- stage pages (title card + terminal)
const BASE_CSS = `
  html,body{margin:0;height:100%;background:#0a0a0a;color:#f5f5f4;
    font-family:-apple-system,BlinkMacSystemFont,"Inter","Segoe UI",sans-serif}`
const CARD_HTML = `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
  body{display:flex;align-items:center;justify-content:center;
    background:radial-gradient(900px 500px at 50% 30%,rgba(249,115,22,.16),transparent 70%),#0a0a0a}
  main{max-width:1000px;padding:0 60px;text-align:center}
  .k{display:inline-block;border:1px solid rgba(249,115,22,.5);color:#fdba74;border-radius:999px;
    padding:6px 16px;font-size:15px;letter-spacing:.04em;margin-bottom:28px}
  h1{font-size:64px;line-height:1.08;margin:0 0 24px;letter-spacing:-.03em;text-wrap:balance}
  p{font-size:23px;line-height:1.5;color:#a8a29e;margin:0;text-wrap:pretty}
  ul{list-style:none;padding:0;margin:34px 0 0;font-size:20px;color:#d6d3d1;line-height:1.9;text-align:left;display:inline-block}
  li::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#f97316;margin-right:14px;vertical-align:middle}
</style><main><div class="k" id="k"></div><h1 id="h"></h1><p id="p"></p><ul id="u"></ul></main>
<script>const d=JSON.parse(decodeURIComponent(location.hash.slice(1)));
k.textContent=d.kicker||'';if(!d.kicker)k.remove();h.textContent=d.title;p.textContent=d.body||'';
for(const i of d.points||[]){const li=document.createElement('li');li.append(i);u.append(li)}</script>`
const TERM_HTML = `<!doctype html><meta charset="utf-8"><style>${BASE_CSS}
  body{display:flex;flex-direction:column;padding:28px 36px 96px;box-sizing:border-box}
  .bar{display:flex;align-items:center;gap:8px;background:#1c1917;border:1px solid #292524;border-bottom:0;
    border-radius:12px 12px 0 0;padding:12px 16px;font-size:14px;color:#a8a29e}
  .dot{width:12px;height:12px;border-radius:50%;background:#44403c}
  .bar span{margin-left:10px}
  #t{flex:1;margin:0;overflow:hidden;background:#0c0a09;border:1px solid #292524;border-radius:0 0 12px 12px;
    padding:20px 24px;font:17px/1.55 ui-monospace,"SF Mono",Menlo,monospace;white-space:pre-wrap;word-break:break-all;
    display:flex;flex-direction:column;justify-content:flex-end}
  #o{overflow:hidden}
  .p{color:#f97316}.cur{display:inline-block;width:9px;height:19px;background:#f5f5f4;vertical-align:-3px;animation:b 1s steps(1) infinite}
  @keyframes b{50%{opacity:0}}
</style><div class="bar"><i class="dot"></i><i class="dot"></i><i class="dot"></i><span id="title">demo/agent — zsh</span></div>
<pre id="t"><div id="o"></div></pre>
<script>
  const o=document.getElementById('o');let cur;
  const tail=()=>{while(o.scrollHeight>o.parentElement.clientHeight-40&&o.firstChild)o.firstChild.remove()}
  window.term={
    prompt(){const l=document.createElement('div');l.innerHTML='<span class="p">agent $</span> <span class="c"></span><span class="cur"></span>';o.append(l);cur=l;tail()},
    key(ch){cur.querySelector('.c').append(ch)},
    enter(){cur.querySelector('.cur').remove()},
    out(html){const l=document.createElement('span');l.innerHTML=html;o.append(l);tail()},
    clear(){o.innerHTML=''}
  }
</script>`

function startStage() {
  const server = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8')
    res.end(req.url.startsWith('/terminal') ? TERM_HTML : CARD_HTML)
  })
  return new Promise((resolve) => server.listen(STAGE_PORT, '127.0.0.1', () => resolve(server)))
}

// ---------------------------------------------------------------- on-screen helpers
async function caption(page, text) {
  await page.evaluate((text) => {
    let el = document.getElementById('__demo_caption')
    if (!el) {
      el = document.createElement('div')
      el.id = '__demo_caption'
      el.style.cssText =
        'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:2147483647;max-width:1100px;' +
        'background:rgba(12,10,9,.94);color:#fafaf9;border:1px solid rgba(249,115,22,.55);border-radius:12px;' +
        'padding:13px 22px;font:500 19px/1.4 -apple-system,BlinkMacSystemFont,Inter,sans-serif;text-align:center;' +
        'box-shadow:0 10px 40px rgba(0,0,0,.6);pointer-events:none;transition:opacity .25s'
      document.body.append(el)
    }
    el.style.opacity = text ? '1' : '0'
    if (text) el.textContent = text
  }, text)
}

const SHOTS = path.join(HERE, 'screenshots')
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })

async function card(page, data, ms = 4500) {
  await page.goto(`http://127.0.0.1:${STAGE_PORT}/card#${encodeURIComponent(JSON.stringify(data))}`)
  await sleep(ms)
}

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ANSI = { 1: 'font-weight:700', 2: 'color:#78716c', 31: 'color:#f87171', 32: 'color:#4ade80', 33: 'color:#fbbf24', 36: 'color:#67e8f9' }
function ansiToHtml(text) {
  let open = 0
  const html = esc(text).replace(/\x1b\[([\d;]*)m/g, (_, codes) => {
    let out = ''
    for (const code of (codes || '0').split(';').map(Number)) {
      if (code === 0) { out += '</span>'.repeat(open); open = 0 }
      else if (ANSI[code]) { out += `<span style="${ANSI[code]}">`; open++ }
    }
    return out
  })
  return html + '</span>'.repeat(open)
}

/** Type a command into the on-screen terminal, really run it in demo/agent, stream its output. */
async function run(page, shown, cmd, cmdArgs, { settle = 2500 } = {}) {
  await page.evaluate(() => window.term.prompt())
  for (const ch of shown) {
    await page.evaluate((c) => window.term.key(c), ch)
    await sleep(18 + Math.random() * 30)
  }
  await sleep(500)
  await page.evaluate(() => window.term.enter())
  let output = ''
  const code = await new Promise((resolve) => {
    const child = spawn(cmd, cmdArgs, { cwd: AGENT_DIR, env: { ...process.env, FORCE_COLOR: '1' } })
    let chain = Promise.resolve()
    const onData = (buf) => {
      const text = buf.toString()
      output += text
      chain = chain.then(() => page.evaluate((h) => window.term.out(h), ansiToHtml(text)))
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('close', (c) => chain.then(() => resolve(c)))
  })
  await sleep(settle)
  return { code, output: output.replace(/\x1b\[[\d;]*m/g, '') }
}

// ---------------------------------------------------------------- scenes
async function sceneWeb(page, s, sign) {
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
  const file = path.join(OUT, `tmp/solana-demo-${stamp}.txt`)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  // ~1.5 MB so the quoted price is more than a single lamport
  fs.writeFileSync(file, `toju Solana testnet demo upload\nrecorded ${new Date().toISOString()}\n` + 'toju demo data '.repeat(100_000))

  await card(page, {
    kicker: 'Part 1 · Humans',
    title: 'Pay for IPFS storage with SOL',
    body: 'The toju web app running locally, connected to Solana testnet. Upload a file, pay the storage fee on-chain, get back a CID.',
  })

  await page.goto(UI, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: '[class*="tsd-"],[class*="tanstack" i],button[aria-label*="TanStack" i]{display:none!important}' })
  await sleep(1200)
  await caption(page, 'toju web app, served from the GitHub repo on localhost — API, database and UI all running locally')
  await sleep(4200)
  await shot(page, '01-home')
  await page.mouse.wheel(0, 620); await sleep(2600)
  await page.mouse.wheel(0, -620); await sleep(900)

  await page.goto(`${UI}/app`, { waitUntil: 'domcontentloaded' })
  await page.addStyleTag({ content: '[class*="tsd-"],[class*="tanstack" i],button[aria-label*="TanStack" i]{display:none!important}' })
  await sleep(1200)
  await caption(page, 'Step 1 — connect a Solana wallet (a scripted testnet wallet, so the recording needs no browser extension)')
  await sleep(2600)
  await page.getByRole('button', { name: 'Connect Wallet' }).click()
  await sleep(2200)
  await shot(page, '02-connect-wallet')
  await page.getByRole('button', { name: /Demo Testnet Wallet/ }).click()
  await sleep(2600)

  await caption(page, 'Step 2 — choose a file and a storage duration')
  await page.locator('input[type=file]:not([webkitdirectory])').first().setInputFiles(file)
  await sleep(3200)
  await page.getByText('90 Days').click(); await sleep(1800)
  await page.getByText('30 Days').click(); await sleep(1500)
  await page.getByText('Payment Summary').evaluate((el) => el.scrollIntoView({ block: 'start', behavior: 'smooth' }))
  await sleep(900)
  await caption(page, 'The price is quoted live by the local API: bytes × days × rate, converted to SOL at the current SOL/USD price')
  await sleep(5200)
  await shot(page, '03-quote')

  if (!s.webReady) {
    await caption(page, 'DRY RUN — upload not performed: this recording was made before the wallet was funded / pinning was configured')
    await sleep(5000)
    return
  }

  await caption(page, 'Step 3 — Upload & Deposit: the file is pinned to IPFS and a deposit transaction is built for the toju program')
  await page.getByRole('button', { name: 'Upload & Deposit' }).click()
  await sleep(1800)
  const noEmail = page.getByRole('button', { name: 'Proceed Without Email' })
  if (await noEmail.isVisible().catch(() => false)) { await sleep(1200); await noEmail.click() }
  const go = page.getByRole('button', { name: /^(Continue|Upload Anyway)$/ })
  await go.waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => /^(Continue|Upload Anyway)$/.test(b.textContent.trim()) && !b.disabled), null, { timeout: 60_000 })
  await sleep(1500)
  sign.onSign = () => caption(page, 'Step 4 — the wallet signs the deposit transaction; it is sent to Solana testnet')
  await go.click()

  await page.getByText('Upload Successful!', { exact: true }).waitFor({ timeout: 180_000 })
  await sleep(1500)
  await caption(page, 'Paid on-chain in SOL — the file is on IPFS and addressed by its CID')
  await sleep(3000)
  await shot(page, '04-upload-success')
  await sleep(3000)
  await page.getByRole('button', { name: 'View Upload History' }).click()
  await sleep(2500)
  await caption(page, 'Upload history for this wallet: CID, size, expiry, and the option to renew storage')
  await sleep(2500)
  await shot(page, '05-history')
  await sleep(3000)
  await page.getByRole('link', { name: 'Transactions' }).click()
  await caption(page, 'Every payment is recorded with its Solana transaction signature')
  await sleep(2500)
  await shot(page, '06-transactions')
  await sleep(2500)
}

async function sceneAgent(page, s) {
  const stamp = new Date().toTimeString().slice(0, 8).replace(/:/g, '')
  const note = `test-data/agent-note-${stamp}.txt`
  const memory = `test-data/agent-memory-${stamp}.json`
  fs.writeFileSync(path.join(AGENT_DIR, note), `Agent note written ${new Date().toISOString()}\nStored autonomously, paid in USDC via x402.\n`)
  fs.writeFileSync(path.join(AGENT_DIR, memory), JSON.stringify({ kind: 'agent-memory', createdAt: new Date().toISOString(), facts: ['x402 lets an HTTP API ask for payment with status 402', 'toju prices storage per byte per day'] }, null, 2))

  await card(page, {
    kicker: 'Part 2 · AI agents',
    title: 'An agent that pays for its own storage',
    body: 'No wallet popup and no human in the loop. The agent calls the storage API, is quoted a price over HTTP 402, signs a USDC payment, and gets back a CID.',
    points: ['@toju.network/x402 — the agent SDK', 'x402 protocol — HTTP-native payments', 'USDC on Base Sepolia (testnet)', s.llm ? 'LangChain agent calling a store_file_ipfs tool' : 'SDK called directly (no LLM in this recording)'],
  }, 7500)

  await page.goto(`http://127.0.0.1:${STAGE_PORT}/terminal`)
  await sleep(800)

  await caption(page, 'The agent has its own wallet holding test USDC on Base Sepolia')
  await run(page, 'node balance.mjs', 'node', ['balance.mjs'])

  const store = (file, days) =>
    s.llm
      ? run(page, `npx tsx langchain-agent.ts "Store ./${file} on IPFS for ${days} days."`, 'npx', ['tsx', 'langchain-agent.ts', `Store ./${file} on IPFS for ${days} days.`], { settle: 6500 })
      : run(page, `node direct.mjs ./${file} ${days}`, 'node', ['direct.mjs', `./${file}`, String(days)], { settle: 6500 })

  if (!s.agentReady) {
    await caption(page, 'DRY RUN — the agent wallet is not funded yet, so the facilitator refuses the payment and the API answers 402 again')
    await store(note, 30)
    await sleep(3000)
    return
  }

  await caption(page, s.llm ? 'Ask the agent in plain English. It decides to call its storage tool.' : 'Ask the SDK to store a file for 30 days')
  const first = await store(note, 30)
  await caption(page, '402 Payment Required → the SDK signs an EIP-3009 USDC authorization → retries → 200 with the CID')
  await shot(page, '07-agent-store')
  await sleep(7000)

  await page.evaluate(() => window.term.clear())
  await caption(page, 'Same file again: content on IPFS is immutable, so the API recognises the CID and refuses to charge twice (409)')
  await store(note, 30)
  await shot(page, '08-agent-duplicate-409')
  await sleep(4500)

  await page.evaluate(() => window.term.clear())
  await caption(page, 'A different file, 60 days — for example the agent persisting its own memory')
  await store(memory, 60)
  await shot(page, '09-agent-memory-60-days')
  await sleep(5000)

  const cid = first.output.match(/\b(baf[a-z0-9]{20,})\b/)?.[1]
  if (cid && s.gateway) {
    await page.evaluate(() => window.term.clear())
    const url = `${s.gateway.replace(/\/$/, '')}/ipfs/${cid}/${path.basename(note)}`
    await caption(page, 'Reading the first file back from a public IPFS gateway by its CID')
    await run(page, `curl -sL ${url}`, 'curl', ['-sL', '-m', '40', url], { settle: 5000 })
    await shot(page, '10-gateway-readback')
  }
  await page.evaluate(() => window.term.clear())
  await caption(page, 'The agent paid a fraction of a cent, in USDC, by itself')
  await run(page, 'node balance.mjs', 'node', ['balance.mjs'], { settle: 4500 })
}

// ---------------------------------------------------------------- main
const s = await preflight()
const want = { web: SCENE === 'all' || SCENE === 'web', agent: SCENE === 'all' || SCENE === 'agent' }
const ready = (!want.web || s.webReady) && (!want.agent || s.agentReady)
if (!ready && !PARTIAL) {
  console.log('\nNot everything needed for a full recording is in place (see MISS above).')
  console.log('Fix those, or pass --partial to record a clearly-labelled dry run.')
  process.exit(1)
}

fs.mkdirSync(OUT, { recursive: true })
fs.mkdirSync(SHOTS, { recursive: true })
const stage = await startStage()
const rawDir = path.join(OUT, 'raw')
fs.rmSync(rawDir, { recursive: true, force: true })
const browser = await chromium.launch({ channel: 'chrome', headless: !HEADED })
const context = await browser.newContext({ viewport: SIZE, deviceScaleFactor: 1, recordVideo: { dir: rawDir, size: SIZE } })
const sign = { onSign: null }
await installDemoWallet(context, s.wallets.solanaUser.secretKey, { onSign: () => sign.onSign?.() })
const page = await context.newPage()

let failure = null
try {
  await card(page, {
    kicker: ready ? 'Local demo · testnet' : 'DRY RUN · local demo · testnet',
    title: 'toju — pay-as-you-go storage on IPFS',
    body: 'Pay per upload with crypto. No credit card, no subscription. For people, and for AI agents.',
  }, 5500)
  if (want.web) await sceneWeb(page, s, sign)
  if (want.agent) await sceneAgent(page, s)
  await card(page, {
    title: 'toju.network',
    body: 'Storage that people and agents can pay for on their own.',
    points: ['github.com/tojunetwork/afara', 'npm: @toju.network/sol · @toju.network/x402', 'docs.toju.network'],
  }, 6000)
} catch (err) {
  failure = err
  console.error('\nrecording aborted:', err.message)
  await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {})
}

const video = page.video()
await context.close()
await browser.close()
stage.close()

const name = `toju-demo${SCENE === 'all' ? '' : `-${SCENE}`}${ready && !failure ? '' : '-DRYRUN'}`
const mp4 = path.join(OUT, `${name}.mp4`)
execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', await video.path(), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', mp4])
console.log(`\n${failure ? 'INCOMPLETE recording' : 'recording'} saved: ${mp4}`)
process.exit(failure ? 1 : 0)
