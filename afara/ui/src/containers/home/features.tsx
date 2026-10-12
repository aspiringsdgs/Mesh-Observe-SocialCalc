import { Box, SimpleGrid, Text } from '@chakra-ui/react'
import {
  ArrowsClockwiseIcon,
  CodeIcon,
  GlobeHemisphereWestIcon,
  RobotIcon,
  ShieldCheckIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import { FeatureCard, Section, Terminal, tones } from './ui'
import type { Tone } from './ui'

const solSteps: Array<{ label: string; text: string; tone: Tone }> = [
  {
    label: 'Quote',
    text: 'The API computes the CID and prices the upload live.',
    tone: 'cyan',
  },
  {
    label: 'Sign',
    text: 'Your wallet signs one deposit transaction on Solana.',
    tone: 'violet',
  },
  {
    label: 'Pin',
    text: 'The file is pinned to IPFS and recorded with its expiry.',
    tone: 'emerald',
  },
]

export const FeatureShowcase = () => (
  <Section
    id="features"
    eyebrow="What's inside"
    tone="violet"
    title="Two ways to pay. One storage layer."
    lead="Every flow below runs against real testnets: real transactions, real IPFS pins, and a real LLM agent that settles its own bill."
  >
    <SimpleGrid mt="2.5rem" columns={{ base: 1, lg: 2 }} gap="0.75rem">
      <FeatureCard
        icon={WalletIcon}
        tone="cyan"
        label="People · SOL"
        title="Pay for storage from your wallet"
        text="Pick a file and a duration in the dashboard. The price is quoted live, you sign once, and the CID comes back."
      >
        <SimpleGrid columns={3} gap="0.5rem">
          {solSteps.map((step, i) => (
            <Box
              key={step.label}
              pt="0.75rem"
              borderTop={`1px solid ${tones[step.tone].border}`}
            >
              <Text
                fontFamily="var(--font-family-mono)"
                fontSize="var(--font-size-xs)"
                fontWeight="var(--font-weight-bold)"
                color={tones[step.tone].color}
              >
                0{i + 1} {step.label}
              </Text>
              <Text
                mt="0.4rem"
                fontSize="var(--font-size-xs)"
                lineHeight="var(--line-height-relaxed)"
                color="var(--slate-400)"
              >
                {step.text}
              </Text>
            </Box>
          ))}
        </SimpleGrid>
        <Box
          mt="1rem"
          px="0.9em"
          py="0.7em"
          borderRadius="var(--radius-md)"
          border="1px solid var(--border-dark)"
          bg="var(--slate-950)"
          fontFamily="var(--font-family-mono)"
          fontSize="12px"
          color="var(--slate-300)"
          overflowX="auto"
          whiteSpace="nowrap"
        >
          <Text as="span" color="var(--slate-500)">
            cost ={' '}
          </Text>
          bytes × days × 3e-12 USD
          <Text as="span" color="var(--slate-500)">
            {' '}
            → paid in SOL
          </Text>
        </Box>
      </FeatureCard>

      <FeatureCard
        icon={RobotIcon}
        tone="violet"
        label="Agents · USDC · x402"
        title="Agents that pay for their own storage"
        text="A LangChain agent gets one tool, store_file_ipfs. Asked in plain English to store a file, it pays and stores. No wallet popup, no human approval."
      >
        <Terminal
          title="x402 exchange · Base Sepolia"
          lines={[
            { prefix: '→', text: 'POST /upload/agent' },
            {
              prefix: '←',
              text: '402 Payment Required',
              note: 'quote in USDC',
              tone: 'amber',
            },
            {
              prefix: '→',
              text: 'POST /upload/agent',
              note: '+ signed EIP-3009 authorization',
            },
            {
              prefix: '←',
              text: '200 OK',
              note: 'settled on-chain, CID returned',
              tone: 'emerald',
            },
          ]}
        />
      </FeatureCard>
    </SimpleGrid>

    <SimpleGrid mt="0.75rem" columns={{ base: 1, md: 2, lg: 4 }} gap="0.75rem">
      <FeatureCard
        icon={ShieldCheckIcon}
        tone="emerald"
        label="Idempotent"
        title="Never charged twice"
        text="Send the same file again and the API answers 409: already stored, no second payment."
      />
      <FeatureCard
        icon={GlobeHemisphereWestIcon}
        tone="cyan"
        label="Portable"
        title="Read back by CID"
        text="Stored files are content-addressed. Fetch them from any IPFS gateway with the CID alone."
      />
      <FeatureCard
        icon={ArrowsClockwiseIcon}
        tone="violet"
        label="Retention"
        title="Renew before expiry"
        text="You choose how long to store. An email reminder arrives before storage runs out."
      />
      <FeatureCard
        icon={CodeIcon}
        tone="amber"
        label="SDK"
        title="Three packages"
        text={
          <>
            <Box as="code" fontSize="var(--font-size-xs)">
              @toju.network/sol
            </Box>
            ,{' '}
            <Box as="code" fontSize="var(--font-size-xs)">
              /fil
            </Box>{' '}
            and{' '}
            <Box as="code" fontSize="var(--font-size-xs)">
              /x402
            </Box>{' '}
            cover wallets and autonomous agents.
          </>
        }
      />
    </SimpleGrid>
  </Section>
)
