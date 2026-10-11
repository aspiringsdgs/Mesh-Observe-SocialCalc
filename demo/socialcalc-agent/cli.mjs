// node cli.mjs "Create an invoice for ... and store it on IPFS for 60 days."
import { runAgent, usdcBalance, agentAddress, ENDPOINT, MODEL } from './agent.mjs'

const c = { dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m', off: '\x1b[0m' }
const prompt = process.argv[2] || 'Create an invoice from Mesh Works to Acme Robotics for 3 days of observability consulting at $800 per day plus a $450 dashboard setup fee, with 18% tax, and store it on IPFS for 60 days.'
const brief = (o) => { const s = JSON.stringify(o); return s.length > 150 ? `${s.slice(0, 150)}…` : s }

console.log(`${c.bold}SocialCalc agent${c.off}  model=${MODEL}  storage=${ENDPOINT}`)
console.log(`agent wallet ${agentAddress()}  balance ${await usdcBalance()} USDC`)
console.log(`\n${c.cyan}user>${c.off} ${prompt}\n`)

try {
  const r = await runAgent(prompt, (e) => {
    if (e.type === 'status') console.log(`${c.dim}· ${e.message}${c.off}`)
    if (e.type === 'tool_start') console.log(`${c.bold}[${e.n}] ${e.name}${c.off} ${c.dim}${brief(e.args)}${c.off}`)
    if (e.type === 'tool_end' && !e.ok) console.log(`    ${c.red}failed: ${e.output.slice(0, 200)}${c.off}`)
    if (e.type === 'http') {
      const tone = e.status === 402 ? c.yellow : e.status < 300 ? c.green : c.red
      console.log(`    ${c.cyan}→ ${e.method} ${e.path}${c.off}${e.signed ? `  ${c.yellow}[+ signed payment]${c.off}` : ''}`)
      if (e.authorization) console.log(`      ${c.dim}EIP-3009: ${e.authorization.from} → ${e.authorization.to}, ${e.authorization.value} µUSDC${c.off}`)
      console.log(`    ${tone}← ${e.status} ${e.statusText}${c.off}`)
      if (e.quote) console.log(`      ${c.dim}quote ${e.quote.usdc} USDC on ${e.quote.network}${c.off}`)
      if (e.settlement) console.log(`      ${c.dim}settled ${e.settlement.explorer}${c.off}`)
    }
  })
  console.log(`\n${c.green}agent>${c.off} ${r.answer}`)
  console.log(`\nworkbook: workbooks/${r.file}`)
  console.log(`balance after: ${await usdcBalance()} USDC`)
} catch (err) {
  console.error(`\n${c.red}run failed:${c.off} ${err.message}`)
  process.exit(1)
}
