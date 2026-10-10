// Local-dev only: route the Neon HTTP driver to the local-neon-http-proxy container
// instead of a hosted Neon database. Loaded with `node --import ./local-neon.mjs`.
import { neonConfig } from '@neondatabase/serverless'

neonConfig.fetchEndpoint = (host) =>
  host === 'db.localtest.me' ? 'http://localhost:4444/sql' : `https://${host}/sql`
