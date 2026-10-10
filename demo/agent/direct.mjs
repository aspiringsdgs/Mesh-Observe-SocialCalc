// The SDK on its own, no LLM: `node direct.mjs <file> <days>`
import fs from 'node:fs/promises'
import path from 'node:path'
import { createAgentClient } from '@toju.network/x402'
import { ENDPOINT, agentAddress, agentKey, paint as c, traceX402, usdcBalance } from './lib.mjs'

const [file = './test-data/sample.txt', days = '30'] = process.argv.slice(2)
traceX402()

console.log(`${c.bold}toju x402 agent client${c.off}  endpoint=${ENDPOINT}  network=Base Sepolia`)
console.log(`agent wallet ${agentAddress()}  balance ${await usdcBalance(agentAddress())} USDC\n`)

const client = createAgentClient({ privateKey: agentKey(), environment: 'sepolia', endpoint: ENDPOINT })
const buf = await fs.readFile(file)
console.log(`storing ${path.basename(file)} (${buf.length} bytes) for ${days} days\n`)

try {
  const result = await client.store(new File([buf], path.basename(file)), { durationDays: Number(days) })
  console.log(`\n${c.green}${c.bold}stored${c.off}`)
  console.log(result)
  console.log(`\nbalance after: ${await usdcBalance(agentAddress())} USDC`)
} catch (err) {
  console.log(`\n${c.red}store failed:${c.off} ${err.message}`)
  process.exitCode = 1
}
