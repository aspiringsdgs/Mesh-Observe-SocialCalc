// Local-dev only: hermes.pyth.network now rejects keyless requests (401), and the
// server hardcodes that URL. This answers the SOL/USD "latest price" call with the
// live Coinbase spot price, in Pyth's response shape. Every other request is untouched.
// Loaded with `node --import ./local-pyth.mjs`.
const realFetch = globalThis.fetch
const EXPO = -8

globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input?.url ?? String(input))
  if (!url.startsWith('https://hermes.pyth.network/v2/updates/price/latest'))
    return realFetch(input, init)

  const res = await realFetch('https://api.coinbase.com/v2/prices/SOL-USD/spot')
  if (!res.ok) return new Response('price source unavailable', { status: 502 })
  const usd = Number((await res.json()).data.amount)
  const price = {
    price: String(Math.round(usd * 10 ** -EXPO)),
    conf: '0',
    expo: EXPO,
    publish_time: Math.floor(Date.now() / 1000),
  }
  const id = new URL(url).searchParams.get('ids[]')?.replace(/^0x/, '') ?? ''
  console.log(
    JSON.stringify({ level: 'info', message: 'local-pyth shim: SOL/USD from Coinbase spot', usd }),
  )
  return Response.json({
    binary: { encoding: 'hex', data: [] },
    parsed: [{ id, price, ema_price: price, metadata: {} }],
  })
}
