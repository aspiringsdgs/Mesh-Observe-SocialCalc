import { Box, Container, Heading, Text } from '@chakra-ui/react'
import type { BoxProps } from '@chakra-ui/react'
import type { Icon } from '@phosphor-icons/react'
import type { ReactNode } from 'react'

export type Tone = 'cyan' | 'violet' | 'emerald' | 'amber'

export const tones: Record<
  Tone,
  { color: string; border: string; bg: string }
> = {
  cyan: {
    color: 'var(--mesh-cyan)',
    border: 'rgba(var(--mesh-cyan-rgb), 0.5)',
    bg: 'rgba(var(--mesh-cyan-rgb), 0.1)',
  },
  violet: {
    color: 'var(--mesh-violet)',
    border: 'rgba(var(--mesh-violet-rgb), 0.5)',
    bg: 'rgba(var(--mesh-violet-rgb), 0.1)',
  },
  emerald: {
    color: '#6ee7b7',
    border: 'rgba(16, 185, 129, 0.4)',
    bg: 'rgba(16, 185, 129, 0.1)',
  },
  amber: {
    color: '#fcd34d',
    border: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.1)',
  },
}

export const gradientButton = {
  height: 'auto',
  px: '1.25em',
  py: '0.8em',
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-semibold)',
  color: 'var(--text-inverse)',
  bg: 'var(--mesh-gradient)',
  borderRadius: 'var(--radius-md)',
  transition: 'opacity 0.2s',
  _hover: { bg: 'var(--mesh-gradient)', opacity: 0.9, textDecoration: 'none' },
  _active: { bg: 'var(--mesh-gradient)', opacity: 0.8 },
}

export const outlineButton = {
  ...gradientButton,
  bg: 'transparent',
  border: '1px solid var(--slate-700)',
  color: 'var(--slate-200)',
  _hover: { bg: 'var(--slate-800)', textDecoration: 'none' },
  _active: { bg: 'var(--slate-800)' },
}

type EyebrowProps = { children: ReactNode; tone?: Tone }

export const Eyebrow = ({ children, tone = 'cyan' }: EyebrowProps) => (
  <Text
    fontFamily="var(--font-family-mono)"
    fontSize="10px"
    fontWeight="var(--font-weight-bold)"
    textTransform="uppercase"
    letterSpacing="0.25em"
    color={tones[tone].color}
  >
    {children}
  </Text>
)

type SectionProps = BoxProps & {
  eyebrow?: string
  tone?: Tone
  title?: string
  lead?: string
  children: ReactNode
}

export const Section = ({
  eyebrow,
  tone,
  title,
  lead,
  children,
  ...rest
}: SectionProps) => (
  <Box
    as="section"
    borderBottom="1px solid var(--border-dark)"
    px={{ base: '1.5em', sm: '2em' }}
    py={{ base: '4em', md: '5em' }}
    scrollMarginTop="64px"
    {...rest}
  >
    <Container maxW="6xl" px="0">
      {eyebrow && <Eyebrow tone={tone}>{eyebrow}</Eyebrow>}
      {title && (
        <Heading
          as="h2"
          mt="0.75rem"
          fontSize={{ base: '30px', md: '36px' }}
          fontWeight="var(--font-weight-bold)"
          color="var(--text-inverse)"
        >
          {title}
        </Heading>
      )}
      {lead && (
        <Text
          mt="0.75rem"
          maxW="2xl"
          fontSize="var(--font-size-sm)"
          lineHeight="var(--line-height-relaxed)"
          color="var(--slate-400)"
        >
          {lead}
        </Text>
      )}
      {children}
    </Container>
  </Box>
)

type TileProps = { icon: Icon; title: string; text: string; tone: Tone }

export const Tile = ({ icon: TileIcon, title, text, tone }: TileProps) => (
  <Box
    p="1em"
    textAlign="center"
    borderRadius="var(--radius-md)"
    border={`1px solid ${tones[tone].border}`}
    bg={tones[tone].bg}
    color={tones[tone].color}
  >
    <Box as={TileIcon} size={20} mx="auto" />
    <Text
      mt="0.5rem"
      fontSize="var(--font-size-sm)"
      fontWeight="var(--font-weight-bold)"
      color="var(--slate-100)"
    >
      {title}
    </Text>
    <Text
      mt="0.25rem"
      fontSize="var(--font-size-xs)"
      lineHeight="var(--line-height-relaxed)"
      color="var(--slate-400)"
    >
      {text}
    </Text>
  </Box>
)

type FeatureCardProps = BoxProps & {
  icon: Icon
  tone: Tone
  label: string
  title: string
  text: ReactNode
  children?: ReactNode
}

export const FeatureCard = ({
  icon: CardIcon,
  tone,
  label,
  title,
  text,
  children,
  ...rest
}: FeatureCardProps) => (
  <Box
    as="article"
    display="flex"
    flexDirection="column"
    p={{ base: '1.25em', md: '1.5em' }}
    borderRadius="var(--radius-md)"
    border="1px solid var(--border-dark)"
    bg="rgba(15, 23, 43, 0.5)"
    transition="border-color 0.2s"
    _hover={{ borderColor: tones[tone].border }}
    {...rest}
  >
    <Box display="flex" alignItems="center" gap="0.75em">
      <Box
        display="flex"
        alignItems="center"
        justifyContent="center"
        w="36px"
        h="36px"
        flexShrink={0}
        borderRadius="var(--radius-md)"
        border={`1px solid ${tones[tone].border}`}
        bg={tones[tone].bg}
        color={tones[tone].color}
      >
        <CardIcon size={18} />
      </Box>
      <Eyebrow tone={tone}>{label}</Eyebrow>
    </Box>
    <Heading
      as="h3"
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
    {children && (
      <Box mt="1.25rem" flex="1" display="flex" flexDirection="column">
        {children}
      </Box>
    )}
  </Box>
)

export type TerminalLine = {
  prefix?: '→' | '←' | '$' | '✓'
  text: string
  note?: string
  tone?: Tone | 'muted'
}

type TerminalProps = { title: string; lines: Array<TerminalLine> }

export const Terminal = ({ title, lines }: TerminalProps) => (
  <Box
    flex="1"
    overflow="hidden"
    borderRadius="var(--radius-md)"
    border="1px solid var(--border-dark)"
    bg="var(--slate-950)"
    fontFamily="var(--font-family-mono)"
  >
    <Box
      display="flex"
      alignItems="center"
      gap="0.4em"
      px="0.9em"
      py="0.6em"
      borderBottom="1px solid var(--border-dark)"
    >
      {['#f87171', '#fbbf24', '#34d399'].map((dot) => (
        <Box key={dot} w="8px" h="8px" borderRadius="full" bg={dot} />
      ))}
      <Text ml="0.5em" fontSize="11px" color="var(--slate-500)">
        {title}
      </Text>
    </Box>
    <Box px="0.9em" py="0.8em" overflowX="auto">
      {lines.map((line, i) => (
        <Box
          key={i}
          display="flex"
          gap="0.6em"
          fontSize="12px"
          lineHeight="1.9"
          whiteSpace="nowrap"
        >
          <Text as="span" w="1em" flexShrink={0} color="var(--slate-500)">
            {line.prefix ?? ''}
          </Text>
          <Text
            as="span"
            color={
              !line.tone
                ? 'var(--slate-200)'
                : line.tone === 'muted'
                  ? 'var(--slate-500)'
                  : tones[line.tone].color
            }
          >
            {line.text}
          </Text>
          {line.note && (
            <Text as="span" color="var(--slate-500)">
              {line.note}
            </Text>
          )}
        </Box>
      ))}
    </Box>
  </Box>
)

export const Pill = ({ children }: { children: ReactNode }) => (
  <Box
    as="span"
    px="0.75em"
    py="0.4em"
    borderRadius="full"
    border="1px solid var(--slate-700)"
    fontSize="var(--font-size-xs)"
    color="var(--slate-300)"
  >
    {children}
  </Box>
)
