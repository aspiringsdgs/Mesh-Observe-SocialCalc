// An agent that builds a SocialCalc workbook with socialcalc-mcp and then pays for its own
// IPFS storage over x402 (USDC on Base Sepolia) through @toju.network/x402.
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { createAgentClient } from '@toju.network/x402'
import dotenv from 'dotenv'
import { createAgent, initChatModel, modelRetryMiddleware, tool } from 'langchain'
import { createPublicClient, formatUnits, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const HERE = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(HERE, '.env'), quiet: true })
dotenv.config({ path: path.join(HERE, '../agent/.env'), quiet: true }) // shares the demo agent's wallet + LLM key

export const WORKBOOKS_DIR = path.join(HERE, 'workbooks')
export const ENDPOINT = process.env.TOJU_ENDPOINT || 'http://localhost:5040'
export const MODEL =
  process.env.AGENT_MODEL ||
  (process.env.GROQ_API_KEY ? 'groq:openai/gpt-oss-120b' : process.env.ANTHROPIC_API_KEY ? 'anthropic:claude-sonnet-5-5' : 'openai:gpt-4o')
const USDC = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'

// The published socialcalc-mcp exposes 39 tools. Offering all of them costs thousands of prompt
// tokens on every step, so the model sees three compact tools; each one is carried out by calling
// the real MCP tools named in FORMAT_OPS below.
const FILE = { type: 'string', description: 'Workbook file name.' }
const FORMAT_OPS = {
  bold: (r, v) => ['set_font_style', { range: r, bold: !!v }],
  fontSize: (r, v) => ['set_font_size', { range: r, size: String(v) }],
  color: (r, v) => ['set_font_color', { range: r, color: v }],
  bg: (r, v) => ['set_cell_bg', { range: r, color: v }],
  format: (r, v) => ['set_format', { range: r, format: v }],
  align: (r, v) => ['set_alignment', { range: r, align: v }],
  border: (r, v) => ['set_border', { range: r, border: v }],
}

const agentKey = () => {
  const raw = process.env.AGENT_PRIVATE_KEY
  if (!raw) throw new Error('AGENT_PRIVATE_KEY is not set (demo/agent/.env)')
  return raw.startsWith('0x') ? raw : `0x${raw}`
}
export const agentAddress = () => privateKeyToAccount(agentKey()).address

const chain = createPublicClient({ chain: baseSepolia, transport: http() })
export async function usdcBalance() {
  const raw = await chain.readContract({
    address: USDC,
    abi: [{ name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'a', type: 'address' }], outputs: [{ type: 'uint256' }] }],
    functionName: 'balanceOf',
    args: [agentAddress()],
  })
  return formatUnits(raw, 6)
}

// Workbook names come from the model; keep them to a plain file name inside WORKBOOKS_DIR.
export function safeWorkbookName(raw) {
  const name = path.basename(String(raw || '')).replace(/[^A-Za-z0-9._-]/g, '_')
  if (!/\.(json|msc)$/.test(name)) throw new Error('workbookPath must be a .json file name, e.g. "invoice-1042.json"')
  return name
}

const decode = (h) => { try { return JSON.parse(Buffer.from(h, 'base64').toString()) } catch { return null } }

/**
 * Observe (never alter) HTTP traffic to the toju API so the x402 handshake can be shown:
 * 402 quote -> signed retry -> settlement. `emit` is swapped per run; runs are serialised.
 */
let emitHttp = null
const realFetch = globalThis.fetch
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : input.url
  if (!emitHttp || !url.startsWith(ENDPOINT)) return realFetch(input, init)
  const headers = new Headers(init?.headers ?? (typeof input === 'object' ? input.headers : undefined))
  const method = init?.method ?? (typeof input === 'object' ? input.method : 'GET') ?? 'GET'
  const signed = headers.get('payment-signature') || headers.get('x-payment')
  const auth = signed ? decode(signed)?.payload?.authorization : null
  const res = await realFetch(input, init)
  const quote = decode(res.headers.get('payment-required') || '')?.accepts?.[0]
  const settled = decode(res.headers.get('payment-response') || res.headers.get('x-payment-response') || '')
  emitHttp({
    type: 'http', method, path: url.replace(ENDPOINT, ''), status: res.status, statusText: res.statusText,
    signed: !!signed,
    authorization: auth ? { from: auth.from, to: auth.to, value: auth.value } : undefined,
    quote: quote ? { amount: quote.amount, usdc: (Number(quote.amount) / 1e6).toFixed(6), network: quote.network, payTo: quote.payTo } : undefined,
    settlement: settled?.transaction ? { success: settled.success, transaction: settled.transaction, payer: settled.payer, explorer: `https://sepolia.basescan.org/tx/${settled.transaction}` } : undefined,
  })
  return res
}

const systemPrompt = (file) => `You are a spreadsheet agent. You build SocialCalc workbooks with your tools and store the finished file on IPFS with store_workbook_ipfs, which pays the storage fee from your own wallet. Never ask the user for payment or confirmation.

Today is ${new Date().toISOString().slice(0, 10)}. Always use workbookPath "${file}".

Turn 1: call new_workbook, write_range and format_sheet together, in that order.
- write_range: one call, range "A1", "data" as a 2D array holding the whole document, exactly 4 columns (A-D) in every row, null for empty cells. For an invoice use this order: row 1 title; blank row; "From" block (label in A, seller name and address lines in A below it) with the invoice number, issue date and due date as label/value pairs in C/D on the same rows; blank row; "Bill To" block in A; blank row; table header (Description, Qty, Unit Price, Amount); one row per line item; blank row; Subtotal, Tax and Total as label in C and value in D; blank row; a short payment-terms note. Invent realistic details the user did not give. Every computed cell is a formula string starting with "=", e.g. "=B14*C14", "=SUM(D14:D15)", "=D17*0.18". Never type a computed number.
- format_sheet: columnWidths {"A":250,"B":80,"C":130,"D":130}; title bold 20pt; "From"/"Bill To" labels bold; table header bold with bg "#1f2937" and color "#ffffff"; "$#,##0.00" on unit prices, amounts and totals; right-align the numeric columns and the C labels of the totals; a top border on the Total row and bold Total. Do not merge cells.
Turn 2: call store_workbook_ipfs with the number of days the user asked for (30 if unstated). Store only once.
Then reply in 3-5 short plain sentences: what the document is, the CID, the expiry date, and the USDC paid. The user sees the rendered sheet, so do not repeat its rows or formulas and do not use tables. If something failed, say what.`

/**
 * Run one request. `emit(event)` receives a stream of plain objects:
 * status | tool_start | tool_end | http | stored | final | error
 */
export async function runAgent(prompt, emit = () => {}) {
  await fs.mkdir(WORKBOOKS_DIR, { recursive: true })
  const runId = new Date().toISOString().replace(/\D/g, '').slice(2, 14)
  const file = `document-${runId}.json`
  const result = { runId, prompt, file, model: MODEL, stored: null, payment: null, steps: 0 }

  emit({ type: 'status', message: 'Starting SocialCalc MCP server', runId, file, model: MODEL, wallet: agentAddress() })
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(HERE, 'node_modules/socialcalc-mcp/dist/index.js')],
    cwd: WORKBOOKS_DIR, // the server resolves workbook paths against its working directory
    env: { ...process.env, SOCIALCALC_PORT: String(5900 + Math.floor(Math.random() * 90)) },
    stderr: 'ignore',
  })
  const mcp = new Client({ name: 'socialcalc-agent', version: '1.0.0' })
  await mcp.connect(transport)

  try {
    const { tools: mcpTools } = await mcp.listTools()
    const step = async (name, args, fn) => {
      const n = ++result.steps
      emit({ type: 'tool_start', n, name, args })
      const started = Date.now()
      try {
        const output = await fn()
        emit({ type: 'tool_end', n, name, ok: true, ms: Date.now() - started, output: String(output).slice(0, 4000) })
        return output
      } catch (err) {
        emit({ type: 'tool_end', n, name, ok: false, ms: Date.now() - started, output: err.message })
        return `ERROR: ${err.message}`
      }
    }

    const have = new Set(mcpTools.map((t) => t.name))
    const call = (name, args) => step(name, args, async () => {
      if (!have.has(name)) throw new Error(`socialcalc-mcp has no tool named ${name}`)
      const res = await mcp.callTool({ name, arguments: { ...args, workbookPath: safeWorkbookName(args.workbookPath) } })
      const text = (res.content || []).map((c) => c.text).join('\n')
      if (res.isError) throw new Error(text)
      return text
    })
    // The model may ask for several tools in one turn; run them strictly in the order requested.
    let queue = Promise.resolve()
    const inOrder = (fn) => (args) => (queue = queue.then(() => fn(args), () => fn(args)))

    const sheetTools = [
      tool(inOrder(({ workbookPath, sheetName }) => call('new_workbook', { workbookPath, sheetName: sheetName || 'invoice' })), {
        name: 'new_workbook',
        description: 'Create a new, empty SocialCalc workbook file.',
        schema: { type: 'object', properties: { workbookPath: FILE, sheetName: { type: 'string', description: 'No spaces.' } }, required: ['workbookPath'] },
      }),
      tool(inOrder(({ workbookPath, range, data }) => call('write_range', { workbookPath, range: range || 'A1', data })), {
        name: 'write_range',
        description: 'Write a 2D array of values into the sheet starting at a cell. Strings starting with "=" are formulas.',
        schema: {
          type: 'object',
          properties: {
            workbookPath: FILE,
            range: { type: 'string', description: 'Top-left cell, e.g. A1.' },
            data: { type: 'array', items: { type: 'array', items: { anyOf: [{ type: 'string' }, { type: 'number' }, { type: 'null' }] } } },
          },
          required: ['workbookPath', 'range', 'data'],
        },
      }),
      tool(inOrder(async ({ workbookPath, formats = [], columnWidths = {}, merges = [] }) => {
        const done = []
        for (const range of merges) done.push(await call('merge_cells', { workbookPath, range }))
        for (const [column, width] of Object.entries(columnWidths)) done.push(await call('set_col_width', { workbookPath, column, width: Number(width) }))
        for (const { range, ...opts } of formats)
          for (const [key, value] of Object.entries(opts))
            if (FORMAT_OPS[key] && value !== undefined && value !== null) {
              const [name, args] = FORMAT_OPS[key](range, value)
              done.push(await call(name, { workbookPath, ...args }))
            }
        const failed = done.filter((d) => String(d).startsWith('ERROR'))
        return failed.length ? `${done.length - failed.length} applied, ${failed.length} failed: ${failed.join('; ').slice(0, 600)}` : `${done.length} formatting operations applied.`
      }), {
        name: 'format_sheet',
        description: 'Apply formatting to the sheet in one call: per-range styles, column widths and merged ranges.',
        schema: {
          type: 'object',
          properties: {
            workbookPath: FILE,
            formats: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  range: { type: 'string', description: 'e.g. A1 or A10:D10' },
                  bold: { type: 'boolean' },
                  fontSize: { type: 'string', description: 'e.g. 18pt' },
                  color: { type: 'string', description: 'text colour, hex' },
                  bg: { type: 'string', description: 'background colour, hex' },
                  format: { type: 'string', description: 'number format, e.g. $#,##0.00' },
                  align: { type: 'string', enum: ['left', 'center', 'right'] },
                  border: { type: 'string', description: 'e.g. 1px solid #cccccc' },
                },
                required: ['range'],
              },
            },
            columnWidths: { type: 'object', description: 'Column letter to width in pixels, e.g. {"A":260,"B":70}', additionalProperties: { type: 'number' } },
            merges: { type: 'array', items: { type: 'string' }, description: 'Ranges to merge, e.g. A1:D1' },
          },
          required: ['workbookPath'],
        },
      }),
      tool(inOrder(async ({ workbookPath }) => String(await call('read_sheet', { workbookPath })).split('#### Raw Cell Details')[0].trim()), {
        name: 'read_sheet',
        description: 'Read the sheet back as a table. Use only if you need to check something.',
        schema: { type: 'object', properties: { workbookPath: FILE }, required: ['workbookPath'] },
      }),
    ]

    const storeTool = tool(
      inOrder(({ workbookPath, durationDays }) => step('store_workbook_ipfs', { workbookPath, durationDays }, async () => {
        const name = safeWorkbookName(workbookPath)
        const buffer = await fs.readFile(path.join(WORKBOOKS_DIR, name))
        const client = createAgentClient({ privateKey: agentKey(), environment: 'sepolia', endpoint: ENDPOINT })
        const stored = await client.store(new File([buffer], name, { type: 'application/json' }), { durationDays })
        result.stored = { ...stored, durationDays }
        emit({ type: 'stored', ...result.stored })
        return JSON.stringify({ ...stored, paidUsdc: result.payment?.usdc, paymentTransaction: result.payment?.transaction })
      })),
      {
        name: 'store_workbook_ipfs',
        description: 'Store the finished workbook file on IPFS. The storage fee is paid automatically in USDC from this agent\'s own wallet (x402). Returns the CID and expiry date.',
        schema: {
          type: 'object',
          properties: {
            workbookPath: FILE,
            durationDays: { type: 'number', description: 'How many days to keep the file on IPFS.' },
          },
          required: ['workbookPath', 'durationDays'],
        },
      },
    )

    emitHttp = (e) => {
      if (e.settlement) result.payment = { ...e.settlement, usdc: result.payment?.usdc }
      if (e.quote) result.payment = { ...(result.payment || {}), usdc: e.quote.usdc, payTo: e.quote.payTo, network: e.quote.network }
      emit(e)
    }
    emit({ type: 'status', message: `Agent ready: socialcalc-mcp (${mcpTools.length} tools available) + store_workbook_ipfs` })

    // Free-tier LLM keys have tight tokens-per-minute limits: wait and retry on 429 instead of failing.
    const model = await initChatModel(MODEL, { maxRetries: 0, temperature: 0 })
    const retry = modelRetryMiddleware({
      maxRetries: 6, initialDelayMs: 12_000, backoffFactor: 1.4, maxDelayMs: 45_000, jitter: false,
      retryOn: (err) => {
        const limited = /429|rate limit/i.test(String(err?.message))
        if (limited) emit({ type: 'status', message: 'LLM rate limit reached, waiting before retrying' })
        return limited
      },
      onFailure: 'error',
    })
    const agent = createAgent({ model, tools: [...sheetTools, storeTool], systemPrompt: systemPrompt(file), middleware: [retry] })
    const out = await agent.invoke({ messages: [{ role: 'user', content: prompt }] }, { recursionLimit: 30 })
    const last = out.messages[out.messages.length - 1]
    result.answer = typeof last.content === 'string' ? last.content : last.content.map((c) => c.text || '').join('')
    result.workbookExists = await fs.access(path.join(WORKBOOKS_DIR, file)).then(() => true, () => false)
    emit({ type: 'final', ...result })
    return result
  } catch (err) {
    emit({ type: 'error', message: err.message })
    throw err
  } finally {
    emitHttp = null
    await mcp.close().catch(() => {})
  }
}
