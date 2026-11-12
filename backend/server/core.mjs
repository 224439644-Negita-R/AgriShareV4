// Request pipeline: security headers, CORS, rate limits, sessions (cookie or bearer), CSRF, role checks, errors.
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.mjs'
import { q, UPLOADS } from './db.mjs'
import { sha256, clientIp, rateLimit, parseCookies, COOKIE, securityHeaders, randomToken, sessionCookie } from './security.mjs'

export class HttpError extends Error {
  constructor(status, message, extra) {
    super(message)
    this.status = status
    this.extra = extra
  }
}
export const bad = (m) => new HttpError(400, m)
export const notFound = (m = 'Not found') => new HttpError(404, m)
export const forbidden = (m) => new HttpError(403, m)

export const routes = []
/** opts: auth=false (public), roles=[...], limit={max,windowMs,by:'ip'|'user'}, raw (form body), maxBody, setup (allowed before admin 2FA), verified (needs confirmed email) */
export const route = (method, p, handler, opts = {}) => {
  const keys = []
  const re = new RegExp('^' + p.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$')
  routes.push({ method, re, keys, handler, name: `${method} ${p}`, ...opts, auth: opts.auth !== false })
}

export function audit(ctx, action, target = '', detail = '') {
  q.run('INSERT INTO audit_log(actor_id,action,target,detail,ip,created_at) VALUES(?,?,?,?,?,?)', ctx?.user?.id ?? null, action, String(target), String(detail).slice(0, 500), ctx?.ip || '', new Date().toISOString())
}

export function reportError(err, where = '') {
  console.error(JSON.stringify({ level: 'error', where, message: err.message, stack: String(err.stack || '').split('\n').slice(0, 4).join(' | ') }))
  if (config.errorWebhook) {
    fetch(config.errorWebhook, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: `AgriShare error ${where}: ${err.message}` }) }).catch(() => {})
  }
}

const NATIVE_ORIGINS = ['capacitor://localhost', 'ionic://localhost', 'https://localhost', 'http://localhost']
function corsOrigin(origin) {
  if (!origin) return ''
  try {
    const o = new URL(origin)
    if (origin === new URL(config.appUrl).origin || config.allowedOrigins.includes(origin)) return origin
    if (config.allowNativeOrigins) {
      if (NATIVE_ORIGINS.includes(origin)) return origin
      // Allow localhost on any dev port (e.g. Metro 8081, Vite 8443, etc.)
      if (['localhost', '127.0.0.1'].includes(o.hostname)) return origin
      // Allow local private network IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x) for phone dev
      if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(o.hostname)) return origin
    }
  } catch {}
  return ''
}

export const MAX_JSON = 100 * 1024
export const MAX_IMAGES = 14 * 1024 * 1024
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let raw = '', over = false
    req.on('data', (c) => {
      if (over) return // keep draining so the client can still receive our 413 answer
      raw += c
      if (raw.length > limit) {
        over = true
        raw = ''
        reject(new HttpError(413, 'That request is too large'))
      }
    })
    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function handleApi(req, res) {
  const started = Date.now()
  const url = new URL(req.url, 'http://localhost')
  const ip = clientIp(req)
  securityHeaders(res)
  const send = (status, data, headers = {}) => {
    res.statusCode = status
    for (const [k, v] of Object.entries(headers)) res.setHeader(k, v)
    if (Buffer.isBuffer(data)) return res.end(data)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.setHeader('Cache-Control', 'no-store')
    res.end(JSON.stringify(data))
  }

  // CORS: same-origin needs nothing; the mobile app's origin gets bearer-token access
  const origin = req.headers.origin
  const allowed = corsOrigin(origin)
  if (origin) res.setHeader('Vary', 'Origin')
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', allowed)
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Client')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  if (req.method === 'OPTIONS') return send(204, {})

  const wait = rateLimit('global:' + ip, 600, 60_000)
  if (wait) return send(429, { error: 'Too many requests. Slow down and try again shortly.' }, { 'Retry-After': wait })

  const file = req.method === 'GET' && /^\/uploads\/([a-f0-9]{16}\.(jpg|png|webp))$/.exec(url.pathname)
  if (file) {
    const p = path.join(UPLOADS, file[1])
    if (!fs.existsSync(p)) return send(404, { error: 'Not found' })
    res.setHeader('Content-Type', MIME[file[2]])
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return fs.createReadStream(p).pipe(res)
  }

  const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname))
  if (!r) return send(404, { error: 'Not found' })
  let user = null
  try {
    if (r.limit) {
      const key = `${r.name}:${r.limit.by === 'user' ? 'u' + (user?.id ?? ip) : ip}`
      const w = rateLimit(key, r.limit.max, r.limit.windowMs)
      if (w) throw new HttpError(429, 'Too many attempts. Please wait and try again.', { retryAfter: w })
    }
    // ---- session ----
    const cookies = parseCookies(req)
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    const token = bearer || cookies[COOKIE] || ''
    const viaCookie = !bearer && !!cookies[COOKIE]
    const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method)
    if (r.auth || token) {
      if (viaCookie && unsafe) {
        // CSRF: browsers can't add this header cross-site without a CORS preflight we refuse
        if (req.headers['x-requested-with'] !== 'AgriShare') throw forbidden('Request blocked (missing security header)')
        if (origin && new URL(origin).host !== req.headers.host && !allowed) throw forbidden('Request blocked (unexpected origin)')
      }
      const s = token && q.get('SELECT * FROM sessions WHERE token_hash = ?', sha256(token))
      if (s && Date.now() - Date.parse(s.created_at) > 30 * 86400000) {
        q.run('DELETE FROM sessions WHERE token_hash = ?', s.token_hash)
      } else if (s) {
        const u = q.get('SELECT * FROM users WHERE id = ?', s.user_id)
        if (u && u.status === 'active') {
          user = u
          if (Date.now() - Date.parse(s.last_seen) > 300_000) q.run('UPDATE sessions SET last_seen = ? WHERE token_hash = ?', new Date().toISOString(), s.token_hash)
        }
      }
      if (r.auth && !user) throw new HttpError(401, 'Please log in')
    }
    if (user) {
      if (r.roles && !r.roles.includes(user.role)) throw forbidden(`Your ${user.role} account doesn't have access to that. This is for ${r.roles.join(' / ')} accounts.`)
      if (user.role === 'Admin' && config.requireAdmin2fa && !user.totp_enabled && !r.setup) throw new HttpError(403, 'Set up two-factor authentication to use the admin tools', { code: '2fa_setup' })
      if (r.verified && config.requireVerifiedEmail && !user.email_verified) throw new HttpError(403, 'Please confirm your email address first (check your inbox)', { code: 'verify_email' })
    }
    // ---- body ----
    const match = r.re.exec(url.pathname)
    const params = Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(match[i + 1])]))
    let body = {}, rawBody = ''
    if (unsafe) {
      rawBody = await readBody(req, r.maxBody || MAX_JSON)
      if (r.raw) body = rawBody
      else if (rawBody) {
        try { body = JSON.parse(rawBody) } catch { throw bad('Invalid JSON') }
        if (body === null || typeof body !== 'object' || Array.isArray(body)) throw bad('Invalid request')
      }
    }
    const headers = {}
    const ctx = {
      req, res, ip, params, body, rawBody, user, token, query: Object.fromEntries(url.searchParams),
      native: req.headers['x-client'] === 'native',
      setCookie: (v) => (headers['Set-Cookie'] = v),
    }
    const out = await r.handler(ctx)
    // routes may return raw bytes: { bytes, type }
    if (out && out.__bytes) return send(200, out.__bytes, { 'Content-Type': out.type, 'Cache-Control': 'private, no-store', ...headers })
    log(req, url, 200, user, started)
    send(200, out, headers)
  } catch (err) {
    const status = err.status || 500
    if (status === 500) reportError(err, `${req.method} ${url.pathname}`)
    log(req, url, status, user, started)
    const h = { ...(err.extra?.retryAfter ? { 'Retry-After': err.extra.retryAfter } : {}), ...(status === 413 ? { Connection: 'close' } : {}) }
    send(status, { error: status === 500 ? 'Something went wrong on our side' : err.message, ...(err.extra?.code ? { code: err.extra.code } : {}) }, h)
  }
}

// logs never contain query strings, bodies, tokens or email addresses
function log(req, url, status, user, started) {
  if (config.prod || process.env.API_LOG) console.log(JSON.stringify({ t: new Date().toISOString(), m: req.method, p: url.pathname.replace(/\/\d+/g, '/:id'), s: status, u: user?.id ?? null, ms: Date.now() - started }))
  else console.log(`[api] ${req.method} ${url.pathname} -> ${status}${user ? ' (' + user.role + ')' : ''}`)
}

// ---------- sessions ----------
export function startSession(ctx, userId) {
  const token = randomToken(32)
  const now = new Date().toISOString()
  q.run('INSERT INTO sessions(token_hash,user_id,created_at,last_seen,user_agent) VALUES(?,?,?,?,?)', sha256(token), userId, now, now, String(ctx.req.headers['user-agent'] || '').slice(0, 200))
  ctx.setCookie(sessionCookie(token, 30 * 86400))
  return ctx.native ? token : undefined // the web app never sees its own token (httpOnly cookie); the native app stores it securely
}
export const clearCookie = (ctx) => ctx.setCookie(sessionCookie('', 0))
