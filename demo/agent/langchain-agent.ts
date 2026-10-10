/**
 * LangChain agent that stores a file on IPFS and pays for it itself (x402, USDC on Base Sepolia).
 * Mirrors https://github.com/kaf-lamed-beyt/x402-langchain, pointed at the local toju API.
 *
 *   tsx langchain-agent.ts "Store ./test-data/sample.txt on IPFS for 30 days."
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createAgent, tool } from 'langchain'
import * as z from 'zod'
import { createAgentClient } from '@toju.network/x402'
// @ts-ignore - plain JS helper
import { ENDPOINT, agentAddress, agentKey, paint as c, traceX402, usdcBalance } from './lib.mjs'

const MODEL =
  process.env.AGENT_MODEL ||
  (process.env.GROQ_API_KEY ? 'groq:openai/gpt-oss-120b' : process.env.ANTHROPIC_API_KEY ? 'anthropic:claude-sonnet-5-5' : 'openai:gpt-4o')

const storeFileTool = tool(
  async ({ filePath, durationDays }: { filePath: string; durationDays: number }) => {
    console.log(`\n${c.bold}[tool] store_file_ipfs${c.off} ${JSON.stringify({ filePath, durationDays })}`)
    try {
      const client = createAgentClient({ privateKey: agentKey(), environment: 'sepolia', endpoint: ENDPOINT })
      const buffer = await fs.readFile(filePath)
      const file = new File([buffer], path.basename(filePath))
      return JSON.stringify(await client.store(file, { durationDays }))
    } catch (err) {
      return JSON.stringify({ error: (err as Error).message })
    }
  },
  {
    name: 'store_file_ipfs',
    description:
      'Store a file on IPFS via toju decentralized storage and pay with USDC autonomously on Base. Returns the IPFS CID and expiration date.',
    schema: z.object({
      filePath: z.string().describe('Path to the file to store'),
      durationDays: z.number().describe('How many days to store the file'),
    }),
  },
)

async function main() {
  const prompt = process.argv[2] || 'Store ./test-data/sample.txt on IPFS for 30 days.'
  traceX402()
  console.log(`${c.bold}LangChain agent + @toju.network/x402${c.off}  model=${MODEL}  endpoint=${ENDPOINT}`)
  console.log(`agent wallet ${agentAddress()}  balance ${await usdcBalance(agentAddress())} USDC`)
  console.log(`\n${c.cyan}user>${c.off} ${prompt}`)

  const agent = createAgent({ model: MODEL, tools: [storeFileTool] })
  const result = await agent.invoke({ messages: [{ role: 'user', content: prompt }] })

  const last = result.messages[result.messages.length - 1]
  const text = typeof last.content === 'string' ? last.content : JSON.stringify(last.content)
  console.log(`\n${c.green}agent>${c.off} ${text}`)
  console.log(`\nbalance after: ${await usdcBalance(agentAddress())} USDC`)
}

main().catch((err) => {
  console.error('Demo failed:', err)
  process.exit(1)
})
