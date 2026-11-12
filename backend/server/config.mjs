// All settings come from environment variables (see .env.example). Safe defaults for development;
// production mode (NODE_ENV=production) refuses to start with unsafe settings.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const env = process.env
const bool = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(v))
const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean)
const prod = env.NODE_ENV === 'production'
const dataDir = path.resolve(env.DATA_DIR || path.join(process.cwd(), 'data'))
fs.mkdirSync(dataDir, { recursive: true })

function loadSecret() {
  if (env.SECRET_KEY) return env.SECRET_KEY
  if (prod) throw new Error('SECRET_KEY must be set in production (at least 32 random characters).')
  const f = path.join(dataDir, '.secret') // dev only: generated once and kept next to the dev database
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString('hex'), { mode: 0o600 })
  return fs.readFileSync(f, 'utf8').trim()
}

export const config = {
  prod,
  port: Number(env.PORT) || 3001,
  dataDir,
  appUrl: (env.APP_URL || 'http://localhost:3001').replace(/\/$/, ''),
  secretKey: loadSecret(),
  seedDemo: bool(env.SEED_DEMO, !prod), // demo accounts + sample listings. Always off in production unless forced.
  admin: { email: (env.ADMIN_EMAIL || '').toLowerCase(), password: env.ADMIN_PASSWORD || '', name: env.ADMIN_NAME || 'Administrator' },
  trustProxy: Number(env.TRUST_PROXY || 0), // number of reverse proxies in front (Render, Railway, Caddy = 1)
  allowedOrigins: list(env.ALLOWED_ORIGINS), // extra origins allowed to call the API with a bearer token
  allowNativeOrigins: bool(env.ALLOW_NATIVE_ORIGINS, true), // capacitor://localhost etc. (the future mobile app)
  requireVerifiedEmail: bool(env.REQUIRE_VERIFIED_EMAIL, prod),
  requireAdmin2fa: bool(env.REQUIRE_ADMIN_2FA, prod),
  mail: {
    provider: env.MAIL_PROVIDER || 'console', // console | resend
    from: env.MAIL_FROM || 'AgriShare <no-reply@localhost>',
    resendKey: env.RESEND_API_KEY || '',
  },
  push: {
    provider: env.PUSH_PROVIDER || 'console', // console | fcm
    fcmProjectId: env.FCM_PROJECT_ID || '',
    fcmClientEmail: env.FCM_CLIENT_EMAIL || '',
    fcmPrivateKey: (env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
  geocoder: env.GEOCODER || 'off', // off | nominatim (free-text address search; needs internet)
  errorWebhook: env.ERROR_WEBHOOK_URL || '', // Slack / Discord / Teams style webhook that receives server errors
  termsVersion: '2026-11-05',
}

// ---- refuse unsafe production setups ----
if (prod && !bool(env.ALLOW_INSECURE_DEFAULTS, false)) {
  const problems = []
  if (config.secretKey.length < 32) problems.push('SECRET_KEY must be at least 32 characters')
  if (!/^https:\/\//.test(config.appUrl)) problems.push('APP_URL must be your public https:// address')
  if (config.mail.provider === 'console') problems.push('MAIL_PROVIDER must be resend (emails are needed for verification and password reset)')
  if (config.mail.provider === 'resend' && !config.mail.resendKey) problems.push('RESEND_API_KEY is required')
  if (config.seedDemo) problems.push('SEED_DEMO must be off in production (demo accounts share a public password)')
  if (problems.length) throw new Error('Unsafe production configuration:\n - ' + problems.join('\n - '))
}
