// Records the SocialCalc + agentic payments demo:  node record-socialcalc.mjs [--headed]
// Drives the real web app at /app/agent. The agent run, the SocialCalc MCP tool calls, the x402
// payment and the IPFS read-back all happen for real while recording.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ffmpegPath from 'ffmpeg-static'
import { chromium } from 'playwright'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, 'out')
const SHOTS = path.join(HERE, 'screenshots')
const UI = 'http://localhost:3000'
const AGENT = 'http://localhost:5050'
const SIZE = { width: 1440, height: 900 }
const PROMPT =
  'Create an invoice from Mesh Works to Acme Robotics for 3 days of observability consulting at $800 per day plus a $450 dashboard setup fee, with 18% tax, and store it on IPFS for 60 days.'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const info = await fetch(`${AGENT}/agent/info`).then((r) => r.json()).catch(() => null)
const uiUp = await fetch(UI).then((r) => r.ok).catch(() => false)
if (!info || !uiUp || !(Number(info.usdc) > 0)) {
  console.log(`not ready: ui=${uiUp} agent=${!!info} usdc=${info?.usdc}. Run ./start.sh and fund the agent wallet.`)
  process.exit(1)
}
console.log(`agent wallet ${info.wallet}  ${info.usdc} USDC  model ${info.model}`)

const CARD = (d) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;color:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,Inter,"Segoe UI",sans-serif;
    background:radial-gradient(900px 500px at 50% 30%,rgba(249,115,22,.16),transparent 70%),#0a0a0a}
  body{display:flex;align-items:center;justify-content:center}
  main{max-width:1040px;padding:0 60px;text-align:center}
  .k{display:inline-block;border:1px solid rgba(249,115,22,.5);color:#fdba74;border-radius:999px;padding:6px 16px;font-size:15px;letter-spacing:.04em;margin-bottom:28px}
  h1{font-size:60px;line-height:1.1;margin:0 0 24px;letter-spacing:-.03em;text-wrap:balance}
  p{font-size:23px;line-height:1.5;color:#a8a29e;margin:0;text-wrap:pretty}
  ul{list-style:none;padding:0;margin:34px 0 0;font-size:20px;color:#d6d3d1;line-height:1.9;text-align:left;display:inline-block}
  li::before{content:"";display:inline-block;width:8px;height:8px;border-radius:50%;background:#f97316;margin-right:14px;vertical-align:middle}
</style><main>${d.kicker ? `<div class="k">${d.kicker}</div>` : ''}<h1>${d.title}</h1><p>${d.body || ''}</p><ul>${(d.points || []).map((x) => `<li>${x}</li>`).join('')}</ul></main>`

async function caption(page, text) {
  await page.evaluate((text) => {
    let el = document.getElementById('__demo_caption')
    if (!el) {
      el = document.createElement('div')
      el.id = '__demo_caption'
      el.style.cssText =
        'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:2147483647;max-width:1100px;' +
        'background:rgba(12,10,9,.95);color:#fafaf9;border:1px solid rgba(249,115,22,.55);border-radius:12px;' +
        'padding:12px 22px;font:500 18px/1.4 -apple-system,BlinkMacSystemFont,Inter,sans-serif;text-align:center;' +
        'box-shadow:0 10px 40px rgba(0,0,0,.6);pointer-events:none'
      document.body.append(el)
    }
    el.style.display = text ? 'block' : 'none'
    if (text) el.textContent = text
  }, text)
}
const shot = (page, name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
const reveal = (locator, block = 'center') => locator.evaluate((el, block) => el.scrollIntoView({ block, behavior: 'smooth' }), block)

fs.mkdirSync(SHOTS, { recursive: true })
const rawDir = path.join(OUT, 'raw')
fs.rmSync(rawDir, { recursive: true, force: true })
const browser = await chromium.launch({ channel: 'chrome', headless: !process.argv.includes('--headed') })
const context = await browser.newContext({ viewport: SIZE, recordVideo: { dir: rawDir, size: SIZE } })
const page = await context.newPage()

let failure = null
try {
  await page.setContent(CARD({
    kicker: 'SocialCalc × agentic payments',
    title: 'Ask for an invoice. The agent builds it, stores it, and pays.',
    body: 'One sentence in, a spreadsheet on IPFS out. The agent pays for the storage from its own wallet.',
    points: ['socialcalc-mcp: the agent’s spreadsheet tools', 'socialcalc-ai: the engine that renders the sheet', '@toju.network/x402: storage paid in USDC, no human approval'],
  }))
  await sleep(7500)

  await page.goto(`${UI}/app/agent`, { waitUntil: 'networkidle' })
  await page.addStyleTag({ content: '[class*="tsd-"],[class*="tanstack" i],button[aria-label*="TanStack" i]{display:none!important}' })
  await sleep(1200)
  await caption(page, 'The agent has its own wallet holding test USDC on Base Sepolia. Nobody approves its payments.')
  await sleep(5000)
  await shot(page, '11-agent-page')

  const box = page.getByLabel('Request for the agent')
  await box.fill('')
  await caption(page, 'A request in plain English: what to make, and how long to keep it')
  await box.pressSequentially(PROMPT, { delay: 16 })
  await sleep(1800)

  await page.getByRole('button', { name: 'Run agent' }).click()
  await caption(page, 'The LLM plans the document and calls the SocialCalc MCP tools: new workbook, cell values, formulas, formatting')
  await page.getByText('socialcalc-mcp').first().waitFor({ timeout: 180_000 })
  await sleep(2500)
  const sheet = page.getByTestId('socialcalc-sheet')
  await reveal(sheet, 'start')
  await caption(page, 'The spreadsheet takes shape as each MCP call lands. Totals are real formulas, calculated by the SocialCalc engine')
  await sleep(1500)

  await page.getByText('store_workbook_ipfs').first().waitFor({ timeout: 300_000 })
  await reveal(page.getByText('store_workbook_ipfs').first())
  await caption(page, 'Document done. Now the agent stores the file: the storage API answers 402 Payment Required with a price')
  await page.getByText('Stored on IPFS, paid by the agent').waitFor({ timeout: 300_000 })
  await page.getByText(/Read back from IPFS/).waitFor({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Run agent' }).waitFor({ timeout: 180_000 })
  await sleep(800)
  await reveal(page.getByText(/← 200/).first())
  await caption(page, '402 → the agent signs a USDC authorization with its own key → retries → 200. The payment settles on Base Sepolia')
  await sleep(1500)
  await shot(page, '12-agent-activity-x402')
  await sleep(6000)

  await reveal(page.getByText('Stored on IPFS, paid by the agent'), 'start')
  await caption(page, 'The receipt: the file’s CID on IPFS, how long it is kept, what the agent paid, and its wallet balance before and after')
  await sleep(1500)
  await shot(page, '13-agent-receipt')
  await sleep(6500)

  await reveal(sheet, 'start')
  await caption(page, 'This is the stored file, fetched back from IPFS by its CID and rendered with the SocialCalc engine')
  await sleep(1500)
  await shot(page, '14-agent-socialcalc-document')
  await sleep(7000)

  const past = page.getByText('Documents this agent has stored')
  if (await past.isVisible().catch(() => false)) {
    await reveal(past, 'center')
    await caption(page, 'Every document the agent has stored can be reopened from IPFS')
    await sleep(5000)
  }

  await page.setContent(CARD({
    title: 'Spreadsheets that agents can make, keep and pay for',
    body: 'SocialCalc for the document. x402 for the payment. IPFS for the storage.',
    points: ['github.com/aspiringsdgs/Mesh-Observe-SocialCalc', 'github.com/aspiringsdgs/socialcalc-ai', 'npm: socialcalc-mcp · socialcalc-ai · @toju.network/x402'],
  }))
  await sleep(6000)
} catch (err) {
  failure = err
  console.error('recording aborted:', err.message)
  await page.screenshot({ path: path.join(OUT, 'failure.png') }).catch(() => {})
}

const video = page.video()
await context.close()
await browser.close()
const mp4 = path.join(OUT, failure ? 'socialcalc-agent-demo-INCOMPLETE.mp4' : 'socialcalc-agent-demo.mp4')
execFileSync(ffmpegPath, ['-y', '-loglevel', 'error', '-i', await video.path(), '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-r', '30', '-movflags', '+faststart', mp4])
fs.rmSync(rawDir, { recursive: true, force: true })
console.log(`${failure ? 'INCOMPLETE recording' : 'recording'} saved: ${mp4}`)
process.exit(failure ? 1 : 0)
