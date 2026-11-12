// AgriShare API entry point: opens the database, loads demo data when allowed, registers all routes.
import { config } from './config.mjs'
import { ensureSchema, createSchema, wipeUploads, q } from './db.mjs'
import { seedDemo, seedAdminFromEnv } from './seed.mjs'
import { reportError } from './core.mjs'

import './routes/auth.mjs'
import './routes/account.mjs'
import './routes/geo.mjs'
import './routes/equipment.mjs'
import './routes/bookings.mjs'
import './routes/operators.mjs'
import './routes/admin.mjs'
import { route, forbidden, audit } from './core.mjs'

if (ensureSchema() === 'created' && config.seedDemo) seedDemo()
if (seedAdminFromEnv()) console.log(`Created the first administrator (${config.admin.email}). Set up two-factor on first login.`)

// Rebuild the demo data. Only exists while demo data is switched on (never in production).
if (config.seedDemo && !config.prod) {
  route('POST', '/reset', (ctx) => {
    createSchema()
    wipeUploads()
    seedDemo()
    seedAdminFromEnv()
    return { ok: true }
  }, { roles: ['Admin'] })
}
route('GET', '/health', () => ({ ok: q.get('SELECT 1 AS ok').ok === 1 }), { auth: false })

process.on('unhandledRejection', (e) => reportError(e instanceof Error ? e : new Error(String(e)), 'unhandledRejection'))
export { handleApi } from './core.mjs'
