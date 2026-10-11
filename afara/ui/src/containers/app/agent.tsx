import {
  Box,
  Button,
  Flex,
  HStack,
  Link,
  SimpleGrid,
  Spinner,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react'
import {
  ArrowSquareOutIcon,
  CheckCircleIcon,
  CopyIcon,
  CurrencyCircleDollarIcon,
  PaperPlaneRightIcon,
  RobotIcon,
  TableIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'
import { renderSheet } from '@/lib/socialcalc'
import type { Workbook } from '@/lib/socialcalc'

const AGENT_URL = (
  import.meta.env.VITE_AGENT_URL || 'http://localhost:5050'
).replace(/\/$/, '')

const SUGGESTIONS = [
  'Create an invoice from Mesh Works to Acme Robotics for 3 days of observability consulting at $800 per day plus a $450 dashboard setup fee, with 18% tax, and store it on IPFS for 60 days.',
  'Make an invoice for a website redesign: 40 hours of design at $65/hour and 25 hours of development at $90/hour, 10% tax. Keep it on IPFS for 30 days.',
  'Build a quote for 12 IoT temperature sensors at $48 each and installation for $600, then store it on IPFS for 90 days.',
]

type Quote = { amount: string; usdc: string; network: string; payTo: string }
type Settlement = {
  success: boolean
  transaction: string
  payer: string
  explorer: string
}
type AgentEvent =
  | { type: 'status'; message: string; file?: string; model?: string }
  | {
      type: 'tool_start'
      n: number
      name: string
      args: Record<string, unknown>
    }
  | {
      type: 'tool_end'
      n: number
      name: string
      ok: boolean
      ms: number
      output: string
    }
  | {
      type: 'http'
      method: string
      path: string
      status: number
      statusText: string
      signed: boolean
      authorization?: { from: string; to: string; value: string }
      quote?: Quote
      settlement?: Settlement
    }
  | {
      type: 'stored'
      cid: string
      expiresAt: string
      fileName: string
      fileSize: number
      durationDays: number
    }
  | { type: 'balance'; before: string | null; after: string | null }
  | { type: 'final'; answer: string; file: string; steps: number }
  | { type: 'error'; message: string }

type Stored = Extract<AgentEvent, { type: 'stored' }>
type Info = {
  wallet: string
  usdc: string | null
  model: string
  network: string
  gateway: string
}
type PastRun = {
  at: string
  runId: string
  prompt: string
  file: string
  stored: Stored | null
  payment: (Partial<Settlement> & { usdc?: string }) | null
}

const short = (s: string, head = 6, tail = 4) =>
  s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s

const describeArgs = (args: Record<string, unknown>) => {
  const { workbookPath: _file, data, ...rest } = args
  const parts = Object.entries(rest).map(
    ([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`,
  )
  if (Array.isArray(data)) parts.push(`${data.length} rows`)
  return parts.join(' · ')
}

const card = {
  bg: 'var(--bg-dark)',
  border: '1px solid var(--border-hover)',
  borderRadius: 'var(--radius-lg)',
  p: '1.25em',
} as const

const SectionTitle = ({
  icon: Icon,
  children,
}: {
  icon: typeof RobotIcon
  children: React.ReactNode
}) => (
  <HStack spacing="0.6em" mb="0.9em">
    <Icon size={20} color="var(--primary-500)" weight="fill" />
    <Text fontWeight="var(--font-weight-semibold)" color="var(--text-inverse)">
      {children}
    </Text>
  </HStack>
)

export const Agent = () => {
  const [prompt, setPrompt] = useState(SUGGESTIONS[0])
  const [events, setEvents] = useState<Array<AgentEvent>>([])
  const [running, setRunning] = useState(false)
  const [info, setInfo] = useState<Info | null>(null)
  const [offline, setOffline] = useState(false)
  const [runs, setRuns] = useState<Array<PastRun>>([])
  const [preview, setPreview] = useState<{
    source: 'building' | 'ipfs'
    label: string
  } | null>(null)
  const sheetRef = useRef<HTMLDivElement>(null)
  const logRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [i, r] = await Promise.all([
        fetch(`${AGENT_URL}/agent/info`).then((res) => res.json()),
        fetch(`${AGENT_URL}/agent/runs`).then((res) => res.json()),
      ])
      setInfo(i)
      setRuns(r)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    logRef.current?.scrollTo({
      top: logRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [events])

  const draw = useCallback(
    async (url: string, source: 'building' | 'ipfs', label: string) => {
      const res = await fetch(url)
      if (!res.ok)
        throw new Error(`could not load the workbook (${res.status})`)
      const table = await renderSheet((await res.json()) as Workbook)
      sheetRef.current?.replaceChildren(table)
      setPreview({ source, label })
    },
    [],
  )

  const showStored = useCallback(
    (cid: string, fileName: string) =>
      draw(
        `${AGENT_URL}/agent/ipfs/${cid}/${encodeURIComponent(fileName)}`,
        'ipfs',
        `Read back from IPFS · ${short(cid, 10, 6)}`,
      ).catch((err) => toast.error(err.message)),
    [draw],
  )

  const run = async () => {
    if (!prompt.trim() || running) return
    setRunning(true)
    setEvents([])
    setPreview(null)
    sheetRef.current?.replaceChildren()
    fileRef.current = null

    try {
      const res = await fetch(`${AGENT_URL}/agent/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.message || `Agent answered ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split('\n\n')
        buffer = frames.pop() ?? ''
        for (const frame of frames) {
          if (!frame.startsWith('data: ')) continue
          const event = JSON.parse(frame.slice(6)) as AgentEvent
          setEvents((prev) => [...prev, event])

          if (event.type === 'status' && event.file)
            fileRef.current = event.file
          // redraw after each spreadsheet step so the document is seen taking shape
          if (
            event.type === 'tool_end' &&
            event.ok &&
            event.name !== 'store_workbook_ipfs' &&
            fileRef.current
          )
            draw(
              `${AGENT_URL}/agent/workbooks/${fileRef.current}`,
              'building',
              'Workbook being built by the agent',
            ).catch(() => {})
          if (event.type === 'stored')
            await showStored(event.cid, event.fileName)
        }
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        },
      ])
    } finally {
      setRunning(false)
      refresh()
    }
  }

  const stored = events.find((e): e is Stored => e.type === 'stored')
  const settlement = events.find((e) => e.type === 'http' && e.settlement)
  const quote = events.find((e) => e.type === 'http' && e.quote)
  const final = events.find((e) => e.type === 'final')
  const balance = events.find((e) => e.type === 'balance')
  const paid = quote?.type === 'http' ? quote.quote : undefined
  const receipt =
    settlement?.type === 'http' ? settlement.settlement : undefined

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copied')
  }

  return (
    <VStack spacing="1.5em" align="stretch">
      <Box>
        <Text
          fontSize="var(--font-size-2xl)"
          fontWeight="var(--font-weight-bold)"
          color="var(--text-inverse)"
        >
          AI Agent
        </Text>
        <Text
          color="var(--text-muted)"
          fontSize="var(--font-size-sm)"
          mt="0.3em"
          maxW="760px"
        >
          Ask for a document in plain English. The agent builds it as a
          SocialCalc spreadsheet with the SocialCalc MCP tools, then stores the
          file on IPFS and pays for the storage itself in USDC over x402. No
          wallet popup, no approval step.
        </Text>
      </Box>

      {offline ? (
        <HStack {...card} borderColor="var(--warning)" spacing="0.8em">
          <WarningCircleIcon size={22} color="var(--warning)" />
          <Text color="var(--text-muted)" fontSize="var(--font-size-sm)">
            The agent service is not reachable at {AGENT_URL}. Start it with{' '}
            <Text as="code" color="var(--text-inverse)">
              node demo/socialcalc-agent/server.mjs
            </Text>
            .
          </Text>
        </HStack>
      ) : (
        info && (
          <SimpleGrid columns={{ base: 2, md: 4 }} spacing="0.8em">
            {[
              ['Agent wallet', short(info.wallet)],
              [
                'Balance',
                info.usdc === null
                  ? '-'
                  : `${Number(info.usdc).toFixed(6)} USDC`,
              ],
              ['Pays on', info.network],
              ['Model', info.model.replace(/^[a-z]+:/, '')],
            ].map(([label, value]) => (
              <Box key={label} {...card} p="0.9em 1.1em">
                <Text fontSize="var(--font-size-xs)" color="var(--text-muted)">
                  {label}
                </Text>
                <Text
                  fontSize="var(--font-size-sm)"
                  color="var(--text-inverse)"
                  fontWeight="var(--font-weight-medium)"
                  isTruncated
                >
                  {value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        )
      )}

      <Box {...card}>
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the document and how long to store it…"
          rows={3}
          resize="vertical"
          bg="var(--bg-darker)"
          borderColor="var(--border-hover)"
          color="var(--text-inverse)"
          fontSize="var(--font-size-sm)"
          _focusVisible={{
            borderColor: 'var(--primary-500)',
            boxShadow: 'none',
          }}
          isDisabled={running}
          aria-label="Request for the agent"
        />
        <Flex
          mt="0.9em"
          gap="0.6em"
          wrap="wrap"
          align="center"
          justify="space-between"
        >
          <HStack spacing="0.5em" wrap="wrap">
            {[
              'Consulting invoice',
              'Web project invoice',
              'Hardware quote',
            ].map((label, i) => (
              <Button
                key={label}
                size="xs"
                variant="outline"
                borderColor="var(--border-hover)"
                color="var(--text-muted)"
                fontWeight="400"
                _hover={{
                  bg: 'var(--bg-darker)',
                  color: 'var(--text-inverse)',
                }}
                onClick={() => setPrompt(SUGGESTIONS[i])}
                isDisabled={running}
              >
                {label}
              </Button>
            ))}
          </HStack>
          <Button
            onClick={run}
            isLoading={running}
            loadingText="Agent working"
            isDisabled={offline || !prompt.trim()}
            bg="var(--text-inverse)"
            color="var(--eerie-black)"
            _hover={{ bg: 'var(--text-inverse)', opacity: 0.9 }}
            rightIcon={<PaperPlaneRightIcon size={18} weight="fill" />}
          >
            Run agent
          </Button>
        </Flex>
      </Box>

      {events.length > 0 && (
        <SimpleGrid
          columns={{ base: 1, lg: 2 }}
          spacing="1.2em"
          alignItems="start"
        >
          <Box {...card}>
            <SectionTitle icon={RobotIcon}>Agent activity</SectionTitle>
            <VStack
              ref={logRef}
              align="stretch"
              spacing="0.45em"
              maxH="430px"
              overflowY="auto"
              pr="0.4em"
              fontSize="var(--font-size-xs)"
            >
              {events.map((e, i) => {
                if (e.type === 'status')
                  return (
                    <Text key={i} color="var(--text-muted)">
                      {e.message}
                    </Text>
                  )
                if (e.type === 'tool_start') {
                  const end = events.find(
                    (x) => x.type === 'tool_end' && x.n === e.n,
                  )
                  const ok = end?.type === 'tool_end' ? end.ok : undefined
                  const isStore = e.name === 'store_workbook_ipfs'
                  return (
                    <HStack key={i} align="start" spacing="0.6em">
                      <Box pt="2px" flexShrink={0}>
                        {ok === undefined ? (
                          <Spinner size="xs" color="var(--primary-500)" />
                        ) : ok ? (
                          <CheckCircleIcon
                            size={15}
                            color="#10b981"
                            weight="fill"
                          />
                        ) : (
                          <WarningCircleIcon
                            size={15}
                            color="#f87171"
                            weight="fill"
                          />
                        )}
                      </Box>
                      <Box minW={0}>
                        <Text
                          color="var(--text-inverse)"
                          fontFamily="var(--font-family-mono)"
                        >
                          <Text
                            as="span"
                            color={isStore ? 'var(--primary-400)' : '#67e8f9'}
                          >
                            {isStore ? 'x402' : 'socialcalc-mcp'}
                          </Text>
                          {' · '}
                          {e.name}
                        </Text>
                        <Text
                          color="var(--text-muted)"
                          noOfLines={2}
                          wordBreak="break-word"
                        >
                          {describeArgs(e.args)}
                        </Text>
                        {end?.type === 'tool_end' && !end.ok && (
                          <Text color="#f87171">
                            {end.output.slice(0, 220)}
                          </Text>
                        )}
                      </Box>
                    </HStack>
                  )
                }
                if (e.type === 'http') {
                  const tone =
                    e.status === 402
                      ? '#fbbf24'
                      : e.status < 300
                        ? '#4ade80'
                        : '#f87171'
                  return (
                    <Box
                      key={i}
                      ml="1.6em"
                      pl="0.8em"
                      borderLeft="2px solid var(--border-hover)"
                      fontFamily="var(--font-family-mono)"
                    >
                      <Text color="#67e8f9" wordBreak="break-all">
                        → {e.method} {e.path}
                        {e.signed && (
                          <Text as="span" color="#fbbf24">
                            {'  + signed payment'}
                          </Text>
                        )}
                      </Text>
                      {e.authorization && (
                        <Text color="var(--text-muted)">
                          EIP-3009 authorization: {short(e.authorization.from)}{' '}
                          → {short(e.authorization.to)}, {e.authorization.value}{' '}
                          µUSDC
                        </Text>
                      )}
                      <Text color={tone}>
                        ← {e.status} {e.statusText}
                      </Text>
                      {e.quote && (
                        <Text color="var(--text-muted)">
                          quote: {e.quote.usdc} USDC on {e.quote.network}
                        </Text>
                      )}
                      {e.settlement && (
                        <Text color="var(--text-muted)">
                          settled on-chain:{' '}
                          {short(e.settlement.transaction, 10, 8)}
                        </Text>
                      )}
                    </Box>
                  )
                }
                if (e.type === 'error')
                  return (
                    <HStack
                      key={i}
                      spacing="0.5em"
                      color="#f87171"
                      align="start"
                    >
                      <WarningCircleIcon size={15} weight="fill" />
                      <Text wordBreak="break-word">
                        {e.message.slice(0, 400)}
                      </Text>
                    </HStack>
                  )
                return null
              })}
              {running && !final && <Text color="var(--text-muted)">…</Text>}
            </VStack>
          </Box>

          <VStack spacing="1.2em" align="stretch" minW={0}>
            {stored && (
              <Box {...card} borderColor="rgba(16,185,129,0.5)">
                <SectionTitle icon={CurrencyCircleDollarIcon}>
                  Stored on IPFS, paid by the agent
                </SectionTitle>
                <VStack
                  align="stretch"
                  spacing="0.55em"
                  fontSize="var(--font-size-sm)"
                >
                  {(
                    [
                      [
                        'File',
                        `${stored.fileName} · ${stored.fileSize.toLocaleString()} bytes`,
                      ],
                      [
                        'Kept for',
                        `${stored.durationDays} days, until ${new Date(stored.expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
                      ],
                      [
                        'Paid',
                        paid ? `${paid.usdc} USDC on Base Sepolia` : '-',
                      ],
                      [
                        'Wallet balance',
                        balance?.type === 'balance' &&
                        balance.before &&
                        balance.after
                          ? `${balance.before} → ${balance.after} USDC`
                          : '-',
                      ],
                    ] as const
                  ).map(([label, value]) => (
                    <Flex key={label} justify="space-between" gap="1em">
                      <Text color="var(--text-muted)" flexShrink={0}>
                        {label}
                      </Text>
                      <Text
                        color="var(--text-inverse)"
                        textAlign="right"
                        wordBreak="break-word"
                      >
                        {value}
                      </Text>
                    </Flex>
                  ))}
                  <Flex justify="space-between" gap="1em" align="center">
                    <Text color="var(--text-muted)">CID</Text>
                    <HStack spacing="0.4em" minW={0}>
                      <Text
                        color="#10b981"
                        fontFamily="var(--font-family-mono)"
                        fontSize="var(--font-size-xs)"
                        isTruncated
                      >
                        {stored.cid}
                      </Text>
                      <Button
                        size="xs"
                        variant="ghost"
                        color="var(--text-muted)"
                        minW="auto"
                        p="0.3em"
                        aria-label="Copy CID"
                        onClick={() => copy(stored.cid)}
                      >
                        <CopyIcon size={15} />
                      </Button>
                    </HStack>
                  </Flex>
                  <HStack spacing="1.2em" pt="0.3em" wrap="wrap">
                    {receipt && (
                      <Link
                        href={receipt.explorer}
                        isExternal
                        color="var(--primary-400)"
                        display="inline-flex"
                        alignItems="center"
                        gap="0.3em"
                      >
                        Payment on BaseScan <ArrowSquareOutIcon size={14} />
                      </Link>
                    )}
                    {info && (
                      <Link
                        href={`${info.gateway}/ipfs/${stored.cid}/${stored.fileName}`}
                        isExternal
                        color="var(--primary-400)"
                        display="inline-flex"
                        alignItems="center"
                        gap="0.3em"
                      >
                        Open on IPFS gateway <ArrowSquareOutIcon size={14} />
                      </Link>
                    )}
                  </HStack>
                </VStack>
              </Box>
            )}

            {final?.type === 'final' && (
              <Box
                {...card}
                fontSize="var(--font-size-sm)"
                color="var(--text-secondary)"
                sx={{
                  'p, li': { mb: '0.4em' },
                  code: { wordBreak: 'break-all' },
                  ul: { pl: '1.2em' },
                }}
              >
                <SectionTitle icon={RobotIcon}>Agent's reply</SectionTitle>
                <ReactMarkdown>{final.answer}</ReactMarkdown>
              </Box>
            )}
            {!stored && !final && (
              <Box {...card}>
                <Text color="var(--text-muted)" fontSize="var(--font-size-sm)">
                  The storage receipt appears here once the agent has paid.
                </Text>
              </Box>
            )}
          </VStack>
        </SimpleGrid>
      )}

      {events.length > 0 && (
        <Box {...card} minW={0}>
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap="0.5em"
            mb="0.9em"
          >
            <HStack spacing="0.6em">
              <TableIcon size={20} color="var(--primary-500)" weight="fill" />
              <Text
                fontWeight="var(--font-weight-semibold)"
                color="var(--text-inverse)"
              >
                SocialCalc document
              </Text>
            </HStack>
            {preview && (
              <Text
                fontSize="var(--font-size-xs)"
                color={
                  preview.source === 'ipfs' ? '#10b981' : 'var(--text-muted)'
                }
              >
                {preview.label}
              </Text>
            )}
          </Flex>
          <Box
            bg="#fff"
            color="#111"
            borderRadius="var(--radius-md)"
            overflow="auto"
            minH="120px"
            p="1em 1.25em"
          >
            <div ref={sheetRef} data-testid="socialcalc-sheet" />
            {!preview && (
              <Text color="#6b7280" fontSize="var(--font-size-sm)" p="1em">
                The spreadsheet appears here as the agent builds it.
              </Text>
            )}
          </Box>
        </Box>
      )}

      {runs.length > 0 && (
        <Box {...card}>
          <SectionTitle icon={TableIcon}>
            Documents this agent has stored
          </SectionTitle>
          <VStack
            align="stretch"
            spacing="0"
            divider={<Box borderTop="1px solid var(--border-hover)" />}
          >
            {runs
              .filter((r) => r.stored)
              .slice(0, 8)
              .map((r) => (
                <Flex
                  key={r.runId}
                  py="0.7em"
                  gap="1em"
                  align="center"
                  justify="space-between"
                  fontSize="var(--font-size-sm)"
                >
                  <Box minW={0}>
                    <Text color="var(--text-inverse)" noOfLines={1}>
                      {r.prompt}
                    </Text>
                    <Text
                      color="var(--text-muted)"
                      fontSize="var(--font-size-xs)"
                      fontFamily="var(--font-family-mono)"
                      isTruncated
                    >
                      {r.stored!.cid} · {r.stored!.durationDays}d ·{' '}
                      {r.payment?.usdc ?? '?'} USDC
                    </Text>
                  </Box>
                  <Button
                    size="xs"
                    variant="outline"
                    borderColor="var(--border-hover)"
                    color="var(--text-muted)"
                    flexShrink={0}
                    onClick={() => {
                      setEvents((prev) =>
                        prev.length
                          ? prev
                          : [
                              {
                                type: 'status',
                                message: `Opened a stored document: ${r.stored!.fileName}`,
                              },
                            ],
                      )
                      showStored(r.stored!.cid, r.stored!.fileName)
                    }}
                  >
                    View from IPFS
                  </Button>
                </Flex>
              ))}
          </VStack>
        </Box>
      )}
    </VStack>
  )
}
