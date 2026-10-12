import { Box, Container, Flex, HStack, Link, Text } from '@chakra-ui/react'

const links = [
  { label: 'Docs', href: 'https://docs.toju.network', external: true },
  {
    label: 'SDK Reference',
    href: 'https://docs.toju.network/sdk/overview',
    external: true,
  },
  {
    label: 'Pricing',
    href: 'https://docs.toju.network/pricing',
    external: true,
  },
  {
    label: 'GitHub',
    href: 'https://github.com/seetadev/IPFS-Solana-SDK',
    external: true,
  },
  { label: 'Discord', href: 'https://discord.gg/5YPxMnAf', external: true },
  {
    label: 'Meshworks',
    href: 'https://mesh-works.net/products/observ',
    external: true,
  },
  { label: 'Terms', href: '/terms' },
]

const monoLabel = {
  fontFamily: 'var(--font-family-mono)',
  fontSize: '11px',
  fontWeight: 'var(--font-weight-bold)',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.1em',
}

export const HomeFooter = () => {
  return (
    <Box
      as="footer"
      borderTop="1px solid var(--border-dark)"
      px={{ base: '1.5em', sm: '2em' }}
      py="3em"
    >
      <Container maxW="6xl" px="0">
        <Flex
          direction={{ base: 'column', md: 'row' }}
          align="center"
          justify="space-between"
          gap="2em"
        >
          <Text
            sx={monoLabel}
            color="var(--slate-500)"
            textAlign={{ base: 'center', md: 'left' }}
          >
            &copy; {new Date().getFullYear()} Mesh Observe • Storage by Toju
            Network
          </Text>

          <Flex
            direction="column"
            align={{ base: 'center', md: 'flex-end' }}
            gap="1.5em"
          >
            <Flex wrap="wrap" justify="center" columnGap="2em" rowGap="1em">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  isExternal={link.external}
                  sx={monoLabel}
                  color="var(--slate-500)"
                  transition="color 0.2s"
                  _hover={{
                    color: 'var(--text-inverse)',
                    textDecoration: 'none',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </Flex>

            <HStack
              spacing="0.5em"
              px="0.75em"
              py="0.4em"
              borderRadius="full"
              border="1px solid var(--slate-700)"
              bg="var(--slate-900)"
            >
              <Text fontSize="11px" color="var(--slate-400)">
                Powered by
              </Text>
              <Text
                fontSize="11px"
                fontWeight="var(--font-weight-semibold)"
                color="var(--slate-200)"
              >
                IPFS · Solana · Base · Filecoin
              </Text>
              <Box w="6px" h="6px" borderRadius="full" bg="var(--mesh-cyan)" />
            </HStack>
          </Flex>
        </Flex>
      </Container>
    </Box>
  )
}
