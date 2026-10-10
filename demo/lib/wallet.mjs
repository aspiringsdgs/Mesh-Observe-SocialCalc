// A Wallet Standard wallet for automated demos. It is a REAL wallet: it holds a testnet
// keypair in the Node process and produces genuine ed25519 signatures; the page only ever
// sees the public key. It registers under its own name so nothing impersonates Phantom etc.
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const readShortVec = (buf, off) => {
  let len = 0, size = 0
  for (;;) {
    const b = buf[off + size]
    len |= (b & 0x7f) << (7 * size)
    size++
    if (!(b & 0x80)) break
  }
  return [len, size]
}

/** Sign a serialized (legacy or v0) Solana transaction in place for `keypair`. */
export function signSerializedTx(bytes, keypair) {
  const tx = Uint8Array.from(bytes)
  const [nSigs, nSigsLen] = readShortVec(tx, 0)
  const msgStart = nSigsLen + 64 * nSigs
  const msg = tx.subarray(msgStart)
  let p = msg[0] & 0x80 ? 1 : 0 // v0 messages carry a version prefix byte
  p += 3 // header
  const [nKeys, nKeysLen] = readShortVec(msg, p)
  p += nKeysLen
  let idx = -1
  for (let i = 0; i < nKeys; i++) {
    const key = msg.subarray(p + 32 * i, p + 32 * (i + 1))
    if (key.every((v, j) => v === keypair.publicKey[j])) { idx = i; break }
  }
  if (idx < 0 || idx >= nSigs) throw new Error('demo wallet is not a required signer of this transaction')
  tx.set(nacl.sign.detached(msg, keypair.secretKey), nSigsLen + 64 * idx)
  return tx
}

export async function installDemoWallet(context, secretKeyArray, { chain = 'solana:testnet', onSign } = {}) {
  const keypair = nacl.sign.keyPair.fromSecretKey(Uint8Array.from(secretKeyArray))
  const address = bs58.encode(keypair.publicKey)

  await context.exposeFunction('__tojuDemoSignTx', async (b64) => {
    const signed = signSerializedTx(Buffer.from(b64, 'base64'), keypair)
    await onSign?.()
    return Buffer.from(signed).toString('base64')
  })

  await context.addInitScript(({ address, pubkey, chain }) => {
    const publicKey = Uint8Array.from(pubkey)
    const toB64 = (u8) => btoa(String.fromCharCode(...u8))
    const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
    const listeners = new Set()
    let accounts = []
    const account = Object.freeze({
      address, publicKey, chains: [chain],
      features: ['solana:signTransaction'], label: 'Demo Testnet Wallet',
    })
    const emit = () => listeners.forEach((l) => l({ accounts }))
    const icon = 'data:image/svg+xml;base64,' + btoa(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#f97316"/><path d="M8 12h16v10H8z" fill="none" stroke="#fff" stroke-width="2"/><circle cx="20.5" cy="17" r="1.6" fill="#fff"/></svg>')
    const wallet = Object.freeze({
      version: '1.0.0',
      name: 'Demo Testnet Wallet',
      icon,
      chains: [chain],
      get accounts() { return accounts },
      features: {
        'standard:connect': { version: '1.0.0', connect: async () => { accounts = [account]; emit(); return { accounts } } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { accounts = []; emit() } },
        'standard:events': { version: '1.0.0', on: (_e, l) => { listeners.add(l); return () => listeners.delete(l) } },
        'solana:signTransaction': {
          version: '1.0.0',
          supportedTransactionVersions: ['legacy', 0],
          signTransaction: async (...inputs) => Promise.all(inputs.map(async ({ transaction }) => ({
            signedTransaction: fromB64(await window.__tojuDemoSignTx(toB64(transaction))),
          }))),
        },
      },
    })
    const register = (api) => api.register(wallet)
    try {
      window.dispatchEvent(new (class extends Event {
        constructor() { super('wallet-standard:register-wallet', { bubbles: false, cancelable: false, composed: false }) }
        get detail() { return register }
      })())
    } catch (e) { console.error('demo wallet register failed', e) }
    window.addEventListener('wallet-standard:app-ready', (e) => register(e.detail))
  }, { address, pubkey: Array.from(keypair.publicKey), chain })

  return { address }
}
