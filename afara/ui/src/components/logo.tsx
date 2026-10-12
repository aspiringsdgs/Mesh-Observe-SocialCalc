import { HStack, Text } from '@chakra-ui/react'
import { useId } from 'react'

type LogoProps = {
  size?: number
  fontSize?: string
  compactOnMobile?: boolean
}

export const Logo = ({
  size = 26,
  fontSize = '17px',
  compactOnMobile = false,
}: LogoProps) => {
  const gradientId = useId()

  return (
    <HStack spacing="0.6em" cursor="pointer">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--mesh-cyan)" />
            <stop offset="100%" stopColor="var(--mesh-violet)" />
          </linearGradient>
        </defs>
        <g
          stroke={`url(#${gradientId})`}
          strokeWidth="4"
          strokeLinejoin="round"
        >
          <path d="M84 50 67 79 33 79 16 50 33 21 67 21Z" />
          <path d="M84 50 33 79 33 21Z" />
        </g>
        <g fill={`url(#${gradientId})`}>
          <circle cx="84" cy="50" r="8" />
          <circle cx="67" cy="79" r="8" />
          <circle cx="33" cy="79" r="8" />
          <circle cx="16" cy="50" r="8" />
          <circle cx="33" cy="21" r="8" />
          <circle cx="67" cy="21" r="8" />
        </g>
      </svg>
      <Text
        fontFamily="var(--space-grotesk)"
        fontSize={fontSize}
        fontWeight="var(--font-weight-semibold)"
        color="var(--text-inverse)"
        letterSpacing="-0.02em"
        whiteSpace="nowrap"
        display={compactOnMobile ? { base: 'none', sm: 'block' } : undefined}
      >
        Mesh Observe
      </Text>
    </HStack>
  )
}
