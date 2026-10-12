import { useAuthContext } from '@/hooks/context'
import {
  Box,
  Button,
  Container,
  Flex,
  Grid,
  Heading,
  SimpleGrid,
  Text,
} from '@chakra-ui/react'
import {
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  ArrowUpRightIcon,
  CoinsIcon,
  HardDrivesIcon,
  RobotIcon,
  TableIcon,
  TreeStructureIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useConnection } from 'wagmi'
import { FeatureShowcase } from './features'
import { SocialCalcShowcase } from './socialcalc'
import {
  Eyebrow,
  gradientButton,
  outlineButton,
  Pill,
  Section,
  Tile,
  tones,
} from './ui'

const REPO_URL = 'https://github.com/seetadev/IPFS-Solana-SDK'

const pillars = [
  {
    icon: HardDrivesIcon,
    title: 'Upload data',
    text: 'Upload from the dashboard or the SDK. Files are hashed and pinned to IPFS.',
  },
  {
    icon: CoinsIcon,
    title: 'Pay with crypto',
    text: 'Settle storage fees with SOL, USDFC, or USDC on Base. Pay only for what you store.',
  },
  {
    icon: ArrowsClockwiseIcon,
    title: 'Renew storage',
    text: 'You decide how long files stay. Renew before they expire.',
  },
]

const steps = [
  'Connect a wallet or fund an agent',
  'Pick a file and a storage duration',
  'Get a live quote for bytes × days',
  'Pay on-chain: SOL, USDFC, or USDC over x402',
  'File pinned to IPFS, CID returned',
]

export const HomePage = () => {
  const { isAuthenticated } = useAuthContext()
  const { address: filAddress } = useConnection()
  const isAnyWalletConnected = isAuthenticated || !!filAddress

  const primaryCta = (
    <Button
      as={Link}
      to="/app"
      disabled={!isAnyWalletConnected}
      sx={outlineButton}
      rightIcon={<ArrowRightIcon weight="bold" />}
    >
      {isAnyWalletConnected ? 'Get started' : 'Connect wallet'}
    </Button>
  )

  const agentCta = (
    <Button
      as={Link}
      to="/app/agent"
      sx={gradientButton}
      rightIcon={<RobotIcon weight="bold" />}
    >
      Try the AI agent
    </Button>
  )

  const repoCta = (
    <Button
      as="a"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      sx={outlineButton}
      rightIcon={<ArrowUpRightIcon weight="bold" />}
    >
      GitHub
    </Button>
  )

  return (
    <Box>
      <Box
        as="header"
        position="relative"
        overflow="hidden"
        borderBottom="1px solid var(--border-dark)"
        px={{ base: '1.5em', sm: '2em' }}
        py={{ base: '4em', md: '6em' }}
      >
        <Box
          className="mesh-wash"
          position="absolute"
          inset="0"
          opacity={0.7}
          pointerEvents="none"
        />
        <Box
          className="mesh-grid"
          position="absolute"
          inset="0"
          opacity={0.2}
          pointerEvents="none"
        />

        <Container maxW="6xl" px="0" position="relative">
          <Grid
            templateColumns={{ base: '1fr', lg: '1.1fr 0.9fr' }}
            alignItems="center"
            gap="3em"
          >
            <Box>
              <Text
                fontFamily="var(--font-family-mono)"
                fontSize="10px"
                fontWeight="var(--font-weight-bold)"
                textTransform="uppercase"
                letterSpacing="0.3em"
                color="var(--mesh-cyan)"
              >
                Mesh Observe · SocialCalc
              </Text>
              <Heading
                as="h1"
                mt="1.25rem"
                maxW="3xl"
                fontSize={{ base: '36px', md: '60px' }}
                fontWeight="800"
                lineHeight="1.1"
                color="var(--text-inverse)"
              >
                Spreadsheets your agents can build, store and pay for.
              </Heading>
              <Text
                mt="1.5rem"
                maxW="2xl"
                fontSize="var(--font-size-xl)"
                lineHeight="var(--line-height-relaxed)"
                color="var(--slate-300)"
              >
                One sentence in. A SocialCalc workbook on IPFS out.
              </Text>
              <Text
                mt="1rem"
                maxW="2xl"
                fontSize="var(--font-size-sm)"
                lineHeight="var(--line-height-relaxed)"
                color="var(--slate-400)"
              >
                The agent builds the document over MCP, stores it, and pays for
                the storage itself in USDC over x402. People can still pay from
                a wallet with SOL or USDFC.
              </Text>

              <Flex mt="2rem" wrap="wrap" align="center" gap="0.75rem">
                {agentCta}
                {primaryCta}
                <Box
                  as="code"
                  display={{ base: 'none', md: 'inline-flex' }}
                  alignItems="center"
                  px="1.25em"
                  py="0.8em"
                  borderRadius="var(--radius-md)"
                  border="1px solid var(--border-dark)"
                  bg="rgba(15, 23, 43, 0.5)"
                  fontFamily="var(--font-family-mono)"
                  fontSize="var(--font-size-sm)"
                  color="var(--slate-400)"
                >
                  npm i socialcalc-mcp
                </Box>
              </Flex>
            </Box>

            <SimpleGrid columns={2} gap="0.75rem">
              <Tile
                icon={TableIcon}
                tone="cyan"
                title="SocialCalc"
                text="A real workbook with live formulas"
              />
              <Tile
                icon={TreeStructureIcon}
                tone="violet"
                title="MCP"
                text="Built with socialcalc-mcp tools"
              />
              <Tile
                icon={CoinsIcon}
                tone="violet"
                title="x402"
                text="Paid in USDC, no human approval"
              />
              <Tile
                icon={HardDrivesIcon}
                tone="emerald"
                title="IPFS"
                text="Stored and read back by CID"
              />
            </SimpleGrid>
          </Grid>
        </Container>
      </Box>

      <Box as="main">
        <Box
          as="section"
          borderBottom="1px solid var(--border-dark)"
          px={{ base: '1.5em', sm: '2em' }}
          py="3.5em"
        >
          <Container maxW="6xl" px="0">
            <SimpleGrid
              columns={{ base: 1, md: 3 }}
              gap="1px"
              overflow="hidden"
              borderRadius="var(--radius-md)"
              border="1px solid var(--border-dark)"
              bg="var(--slate-800)"
            >
              {pillars.map(({ icon: PillarIcon, title, text }) => (
                <Box
                  as="article"
                  key={title}
                  p="1.5em"
                  bg="var(--slate-950)"
                  color="var(--mesh-cyan)"
                >
                  <PillarIcon size={22} />
                  <Heading
                    as="h2"
                    mt="1rem"
                    fontSize="var(--font-size-lg)"
                    fontWeight="var(--font-weight-bold)"
                    color="var(--text-inverse)"
                  >
                    {title}
                  </Heading>
                  <Text
                    mt="0.5rem"
                    fontSize="var(--font-size-sm)"
                    lineHeight="var(--line-height-relaxed)"
                    color="var(--slate-400)"
                  >
                    {text}
                  </Text>
                </Box>
              ))}
            </SimpleGrid>
          </Container>
        </Box>

        <SocialCalcShowcase />
        <FeatureShowcase />

        <Section id="how-it-works" eyebrow="How it works" borderBottom="none">
          <SimpleGrid mt="2rem" columns={{ base: 1, md: 5 }} gap="0.75rem">
            {steps.map((step, i) => (
              <Box key={step} pt="1rem" borderTop="1px solid var(--slate-700)">
                <Text
                  fontFamily="var(--font-family-mono)"
                  fontSize="var(--font-size-xs)"
                  fontWeight="var(--font-weight-bold)"
                  color={tones.violet.color}
                >
                  0{i + 1}
                </Text>
                <Text
                  mt="0.75rem"
                  fontSize="var(--font-size-sm)"
                  fontWeight="var(--font-weight-semibold)"
                  lineHeight="var(--line-height-relaxed)"
                  color="var(--slate-200)"
                >
                  {step}
                </Text>
              </Box>
            ))}
          </SimpleGrid>

          <Flex mt="2.5rem" wrap="wrap" gap="0.5rem">
            <Pill>Usage-based storage</Pill>
            <Pill>Pinata · IPFS</Pill>
            <Pill>Solana</Pill>
            <Pill>Filecoin</Pill>
            <Pill>Base</Pill>
          </Flex>

          <Flex
            mt="3.5rem"
            pt="2.5rem"
            borderTop="1px solid var(--border-dark)"
            direction={{ base: 'column', md: 'row' }}
            align={{ md: 'flex-end' }}
            justify="space-between"
            gap="1.5rem"
          >
            <Box>
              <Eyebrow tone="violet">Ready when you are</Eyebrow>
              <Heading
                as="h2"
                mt="0.75rem"
                maxW="3xl"
                fontSize={{ base: '24px', md: '30px' }}
                fontWeight="var(--font-weight-bold)"
                color="var(--text-inverse)"
              >
                Give your agents a spreadsheet, a wallet and a place to keep
                both.
              </Heading>
            </Box>
            <Flex wrap="wrap" gap="0.75rem" flexShrink={0}>
              {agentCta}
              {repoCta}
            </Flex>
          </Flex>
        </Section>
      </Box>
    </Box>
  )
}
