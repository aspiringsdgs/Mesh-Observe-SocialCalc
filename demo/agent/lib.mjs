import 'dotenv/config'
import { createPublicClient, http, formatUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

export const ENDPOINT = process.env.TOJU_ENDPOINT || 'http://localhost:5040'
export const USDC_BASE_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

export function agentKey() {
  const raw = process.env.AGENT_PRIVATE_KEY
  if (!raw) throw new Error('AGENT_PRIVATE_KEY is not set (see demo/agent/.env)')
  return raw.startsWith('0x') ? raw : `0x${raw}`
}
export const agentAddress = () => privateKeyToAccount(agentKey()).address

const chain = createPublicClient({ chain: baseSepolia, transport: http() })
export async function usdcBalance(address) {
  const raw = await chain.readContract({
    address: USDC_BASE_SEPOLIA,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [address],
  })
  return formatUnits(raw, 6)
}

const c = { dim: '\x1b[2m', cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', bold: '\x1b[1m', off: '\x1b[0m' }
export const paint = c
const decode = (h) => { try { return JSON.parse(Buffer.from(h, 'base64').toString()) } catch { return null } }

/**
 * Wrap global fetch so every HTTP exchange with the toju API is printed. Purely
 * observational: requests and responses pass through unmodified. This is what makes
 * the x402 handshake (402 quote -> signed retry -> settlement) visible on screen.
 */
export function traceX402() {
  const real = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url
    if (!url.startsWith(ENDPOINT)) return real(input, init)
    const headers = new Headers(init?.headers ?? (typeof input === 'object' ? input.headers : undefined))
    const method = init?.method ?? (typeof input === 'object' ? input.method : 'GET') ?? 'GET'
    const paid = headers.get('payment-signature') || headers.get('x-payment')
    console.log(`${c.cyan}→ ${method} ${url.replace(ENDPOINT, '')}${c.off}${paid ? `  ${c.yellow}[+ signed payment header]${c.off}` : ''}`)
    if (paid) {
      const auth = decode(paid)?.payload?.authorization
      if (auth) console.log(`${c.dim}    EIP-3009 authorization: from ${auth.from} → to ${auth.to}, value ${auth.value} (µUSDC)${c.off}`)
    }
    const res = await real(input, init)
    const tone = res.status === 402 ? c.yellow : res.ok ? c.green : c.red
    console.log(`${tone}← ${res.status} ${res.statusText}${c.off}`)
    const need = res.headers.get('payment-required')
    if (need) {
      const a = decode(need)?.accepts?.[0]
      if (a) console.log(`${c.dim}    quote: ${a.amount} µUSDC (${(Number(a.amount) / 1e6).toFixed(6)} USDC) on ${a.network}, payTo ${a.payTo}${c.off}`)
    }
    const settled = res.headers.get('payment-response') || res.headers.get('x-payment-response')
    if (settled) {
      const s = decode(settled)
      if (s) console.log(`${c.dim}    settled: success=${s.success} tx=${s.transaction} payer=${s.payer}${c.off}`)
      if (s?.transaction) console.log(`${c.dim}    https://sepolia.basescan.org/tx/${s.transaction}${c.off}`)
    }
    return res
  }
}
