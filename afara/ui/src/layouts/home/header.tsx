import { ChainSelector } from '@/components/chain-selector'
import { ConnectFilWallet } from '@/components/connect-fil-wallet'
import { ConnectWallet } from '@/components/connect-wallet'
import { Logo } from '@/components/logo'
import { useAuthContext, useChainContext } from '@/hooks/context'
import {
  Box,
  Button,
  Link as ChakraLink,
  Container,
  HStack,
  Text,
} from '@chakra-ui/react'
import {
  GithubLogoIcon,
  LinkBreakIcon,
  WalletIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useConnection, useDisconnect } from 'wagmi'

const navLinks = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/#how-it-works' },
  { label: 'Docs', href: 'https://docs.toju.network', external: true },
]

export const HomeHeader = () => {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isFilModalOpen, setIsFilModalOpen] = useState(false)
  const { selectedChain, setSelectedChain } = useChainContext()
  const { isAuthenticated, user, logout } = useAuthContext()
  const { address: filAddress } = useConnection()
  const { mutate: disconnectFil } = useDisconnect()

  const isConnected = selectedChain === 'sol' ? isAuthenticated : !!filAddress
  const connectedAddress = selectedChain === 'sol' ? user : filAddress

  const handleDisconnect = () => {
    if (selectedChain === 'sol') logout()
    else disconnectFil()
  }

  const truncatePublicKey = (publicKey: string) => {
    if (!publicKey) return ''
    return `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
  }

  return (
    <>
      <Box
        as="header"
        position="fixed"
        top="0"
        left="0"
        right="0"
        height="64px"
        px={{ base: '1em', sm: '2em' }}
        zIndex="100"
        background="rgba(2, 6, 24, 0.8)"
        backdropFilter="blur(12px)"
        borderBottom="1px solid var(--border-dark)"
        transition="all 0.3s ease"
      >
        <Container maxW="6xl" px="0" height="100%">
          <HStack height="100%" justifyContent="space-between">
            <Link to="/">
              <Logo compactOnMobile />
            </Link>

            <HStack spacing="1.75em" alignItems="center">
              <HStack
                as="nav"
                spacing="1.75em"
                display={{ lg: 'flex', base: 'none' }}
              >
                {navLinks.map((link) => (
                  <ChakraLink
                    key={link.label}
                    href={link.href}
                    isExternal={link.external}
                    fontFamily="var(--font-family-mono)"
                    fontSize="var(--font-size-xs)"
                    fontWeight="var(--font-weight-bold)"
                    textTransform="uppercase"
                    letterSpacing="0.15em"
                    whiteSpace="nowrap"
                    color="var(--text-muted)"
                    _hover={{
                      color: 'var(--text-inverse)',
                      textDecoration: 'none',
                    }}
                    transition="color 0.2s"
                  >
                    {link.label}
                  </ChakraLink>
                ))}
              </HStack>

              <HStack spacing="0.8em">
                <Button
                  as="a"
                  background="none"
                  href="https://github.com/seetadev/IPFS-Solana-SDK"
                  target="_blank"
                  color="var(--text-muted)"
                  borderRadius="8px"
                  _hover={{ color: 'var(--text-inverse)', bg: 'none' }}
                  size="sm"
                  display={{ lg: 'flex', md: 'flex', base: 'none' }}
                >
                  <GithubLogoIcon size={22} />
                </Button>

                <ChainSelector
                  value={selectedChain}
                  onChange={setSelectedChain}
                />

                {isConnected && connectedAddress ? (
                  <HStack
                    height="40px"
                    width="fit-content"
                    px="1em"
                    bg="rgba(255,255,255,0.05)"
                    border="1px solid var(--slate-700)"
                    borderRadius="var(--radius-md)"
                    spacing="0.75em"
                  >
                    <WalletIcon
                      size={18}
                      color="var(--primary-500)"
                      weight="fill"
                    />
                    <Text
                      color="var(--text-inverse)"
                      fontSize="var(--font-size-sm)"
                      fontWeight="var(--font-weight-medium)"
                    >
                      {truncatePublicKey(connectedAddress)}
                    </Text>

                    <Box
                      as="span"
                      onClick={handleDisconnect}
                      cursor="pointer"
                      color="var(--text-muted)"
                      display="flex"
                      alignItems="center"
                      _hover={{ color: 'var(--error)' }}
                      transition="color 0.2s"
                    >
                      <LinkBreakIcon size={20} weight="bold" />
                    </Box>
                  </HStack>
                ) : (
                  <Button
                    height="40px"
                    px="1.5em"
                    fontSize="var(--font-size-sm)"
                    fontWeight="var(--font-weight-medium)"
                    bg="var(--mesh-gradient)"
                    color="var(--text-inverse)"
                    borderRadius="var(--radius-md)"
                    transition="opacity 0.2s"
                    _hover={{ bg: 'var(--mesh-gradient)', opacity: 0.9 }}
                    _active={{ bg: 'var(--mesh-gradient)', opacity: 0.8 }}
                    leftIcon={<WalletIcon size={18} weight="fill" />}
                    onClick={() =>
                      selectedChain === 'sol'
                        ? setIsModalOpen(true)
                        : setIsFilModalOpen(true)
                    }
                  >
                    Connect Wallet
                  </Button>
                )}
              </HStack>
            </HStack>
          </HStack>
        </Container>
      </Box>
      <ConnectWallet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
      <ConnectFilWallet
        isOpen={isFilModalOpen}
        onClose={() => setIsFilModalOpen(false)}
      />
    </>
  )
}
