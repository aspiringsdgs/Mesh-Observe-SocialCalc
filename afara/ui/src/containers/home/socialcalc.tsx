import { Box, Button, Flex, Grid, SimpleGrid, Text } from '@chakra-ui/react'
import {
  ArrowRightIcon,
  BrainIcon,
  CurrencyCircleDollarIcon,
  EyeIcon,
  ReceiptIcon,
  TableIcon,
  TreeStructureIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import {
  Eyebrow,
  FeatureCard,
  gradientButton,
  Section,
  Terminal,
  Tile,
} from './ui'

const PROMPT =
  'Create an invoice from Mesh Works to Acme Robotics for 3 days of observability consulting at $800 per day plus a $450 dashboard setup fee, with 18% tax, and store it on IPFS for 60 days.'

// What the agent builds for PROMPT. The amounts are formulas in the stored workbook.
const invoiceRows: Array<{
  cells: [string, string, string, string]
  formula?: string
  kind?: 'head' | 'total'
}> = [
  { cells: ['Description', 'Qty', 'Rate', 'Amount'], kind: 'head' },
  {
    cells: ['Observability consulting', '3', '$800.00', '$2,400.00'],
    formula: '=B14*C14',
  },
  {
    cells: ['Dashboard setup fee', '1', '$450.00', '$450.00'],
    formula: '=B15*C15',
  },
  { cells: ['', '', 'Subtotal', '$2,850.00'], formula: '=SUM(D14:D15)' },
  { cells: ['', '', 'Tax (18%)', '$513.00'], formula: '=D16*0.18' },
  {
    cells: ['', '', 'Total', '$3,363.00'],
    formula: '=D16+D17',
    kind: 'total',
  },
]

const InvoicePreview = () => (
  <Box
    flex="1"
    overflow="hidden"
    borderRadius="var(--radius-md)"
    border="1px solid var(--border-dark)"
    bg="var(--slate-950)"
  >
    <Flex
      align="center"
      justify="space-between"
      gap="1em"
      px="0.9em"
      py="0.6em"
      borderBottom="1px solid var(--border-dark)"
      fontFamily="var(--font-family-mono)"
      fontSize="11px"
      color="var(--slate-500)"
    >
      <Text>invoice.msc</Text>
      <Text color="#6ee7b7">read back from IPFS</Text>
    </Flex>
    <Box overflowX="auto">
      <Box minW="420px">
        {invoiceRows.map((row, i) => (
          <Grid
            key={i}
            templateColumns="2.2fr 0.6fr 1fr 1.3fr"
            borderBottom={
              i === invoiceRows.length - 1
                ? 'none'
                : '1px solid var(--border-dark)'
            }
            bg={
              row.kind === 'head'
                ? 'rgba(var(--mesh-violet-rgb), 0.12)'
                : row.kind === 'total'
                  ? 'rgba(var(--mesh-cyan-rgb), 0.08)'
                  : 'transparent'
            }
          >
            {row.cells.map((cell, j) => (
              <Box
                key={j}
                px="0.75em"
                py="0.55em"
                textAlign={j === 0 ? 'left' : 'right'}
                borderLeft={j === 0 ? 'none' : '1px solid var(--border-dark)'}
              >
                <Text
                  fontSize="12px"
                  fontWeight={
                    row.kind
                      ? 'var(--font-weight-bold)'
                      : 'var(--font-weight-normal)'
                  }
                  color={row.kind ? 'var(--slate-100)' : 'var(--slate-300)'}
                >
                  {cell || ' '}
                </Text>
                {j === 3 && row.formula && (
                  <Text
                    fontFamily="var(--font-family-mono)"
                    fontSize="10px"
                    color="var(--mesh-violet)"
                  >
                    {row.formula}
                  </Text>
                )}
              </Box>
            ))}
          </Grid>
        ))}
      </Box>
    </Box>
  </Box>
)

export const SocialCalcShowcase = () => (
  <Section
    id="socialcalc-agent"
    eyebrow="SocialCalc + agentic payments"
    tone="cyan"
    title="One sentence in. A spreadsheet on IPFS out."
    lead="The agent builds the document as a SocialCalc workbook, stores the file, and pays for the storage itself. Nobody connects a wallet or approves anything."
  >
    <Box
      mt="2.5rem"
      p={{ base: '1em', sm: '1.5em', md: '2em' }}
      borderRadius="var(--radius-md)"
      border="1px solid var(--border-dark)"
      bg="rgba(15, 23, 43, 0.5)"
    >
      <Box
        p="1em"
        borderRadius="var(--radius-md)"
        border="1px solid rgba(var(--mesh-violet-rgb), 0.4)"
      >
        <Eyebrow tone="violet">You ask</Eyebrow>
        <Text
          mt="0.6rem"
          fontSize={{
            base: 'var(--font-size-sm)',
            md: 'var(--font-size-base)',
          }}
          lineHeight="var(--line-height-relaxed)"
          color="var(--slate-200)"
        >
          “{PROMPT}”
        </Text>
      </Box>

      <SimpleGrid mt="0.75rem" columns={{ base: 2, md: 4 }} gap="0.75rem">
        <Tile
          icon={BrainIcon}
          tone="cyan"
          title="Plan"
          text="An LLM reads the request and decides what the document needs"
        />
        <Tile
          icon={TreeStructureIcon}
          tone="violet"
          title="Build"
          text="socialcalc-mcp writes values, formulas and formatting"
        />
        <Tile
          icon={CurrencyCircleDollarIcon}
          tone="amber"
          title="Store and pay"
          text="402 quote, signed USDC authorization, settled on Base Sepolia"
        />
        <Tile
          icon={EyeIcon}
          tone="emerald"
          title="Show"
          text="Fetched back by CID and rendered with live formulas"
        />
      </SimpleGrid>
    </Box>

    <SimpleGrid mt="0.75rem" columns={{ base: 1, lg: 2 }} gap="0.75rem">
      <FeatureCard
        icon={TreeStructureIcon}
        tone="violet"
        label="Agent activity"
        title="Every tool call, then the payment"
        text="The page streams each MCP call as it happens, followed by the x402 exchange that pays for storage."
      >
        <Terminal
          title="socialcalc-agent · MCP + x402"
          lines={[
            { prefix: '✓', text: 'new_workbook', note: 'sheet: invoice' },
            {
              prefix: '✓',
              text: 'write_range',
              note: 'values and formulas',
            },
            {
              prefix: '✓',
              text: 'format_sheet',
              note: 'formats, borders, widths',
            },
            { prefix: '✓', text: 'read_sheet', note: 'check the result' },
            { prefix: '✓', text: 'store_workbook_ipfs', tone: 'cyan' },
            {
              prefix: '←',
              text: '402 Payment Required',
              note: 'quote in USDC',
              tone: 'amber',
            },
            {
              prefix: '←',
              text: '200 OK',
              note: 'signed retry settled, CID returned',
              tone: 'emerald',
            },
          ]}
        />
      </FeatureCard>

      <FeatureCard
        icon={TableIcon}
        tone="cyan"
        label="The document"
        title="A real spreadsheet, not a screenshot"
        text="The stored workbook is read back from IPFS and rendered by the socialcalc-ai engine. Amounts, subtotal, tax and total are live formulas."
      >
        <InvoicePreview />
      </FeatureCard>
    </SimpleGrid>

    <Flex
      mt="0.75rem"
      p={{ base: '1.25em', md: '1.5em' }}
      direction={{ base: 'column', md: 'row' }}
      align={{ md: 'center' }}
      justify="space-between"
      gap="1.25rem"
      borderRadius="var(--radius-md)"
      border="1px solid rgba(16, 185, 129, 0.4)"
      bg="rgba(16, 185, 129, 0.1)"
    >
      <Flex align="flex-start" gap="0.9em">
        <Box color="#6ee7b7" flexShrink={0} mt="0.1em">
          <ReceiptIcon size={22} />
        </Box>
        <Box>
          <Text
            fontSize="var(--font-size-sm)"
            fontWeight="var(--font-weight-bold)"
            color="var(--slate-100)"
          >
            Every run ends with a receipt
          </Text>
          <Text
            mt="0.25rem"
            fontSize="var(--font-size-xs)"
            lineHeight="var(--line-height-relaxed)"
            color="var(--slate-400)"
          >
            CID · expiry date · USDC paid · settlement transaction · agent
            balance before and after
          </Text>
        </Box>
      </Flex>
      <Button
        as={Link}
        to="/app/agent"
        sx={gradientButton}
        flexShrink={0}
        rightIcon={<ArrowRightIcon weight="bold" />}
      >
        Try the AI agent
      </Button>
    </Flex>
  </Section>
)
