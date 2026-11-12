import crypto from 'node:crypto'
import { config } from './config.mjs'

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url')

// ---------- passwords ----------
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16)
  return salt.toString('hex') + ':' + crypto.scryptSync(pw, salt, 64).toString('hex')
}
export function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':')
  const test = crypto.scryptSync(pw, Buffer.from(salt, 'hex'), 64)
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'))
}
/** Returns an error message, or '' when the password is acceptable. */
export function passwordProblem(pw, { email = '', name = '' } = {}) {
  if (pw.length < 10) return 'Password must be at least 10 characters'
  if (pw.length > 200) return 'Password is too long'
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Password needs at least one letter and one number'
  const low = pw.toLowerCase()
  if (email && low.includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length > 3) return "Password can't contain your email name"
  if (name && name.length > 3 && low.includes(name.toLowerCase().replace(/\s+/g, ''))) return "Password can't contain your name"
  if (/^(password|12345|qwerty|letmein|agrishare)/i.test(pw)) return 'That password is too common'
  return ''
}

// ---------- rate limiting (in memory; use Redis if you run more than one server) ----------
const buckets = new Map()
setInterval(() => {
  const now = Date.now()
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k)
}, 60_000).unref()
/** Returns seconds to wait when over the limit, or 0 when allowed. */
export function rateLimit(key, max, windowMs) {
  const now = Date.now()
  let b = buckets.get(key)
  if (!b || b.reset < now) buckets.set(key, (b = { n: 0, reset: now + windowMs }))
  b.n++
  return b.n > max ? Math.ceil((b.reset - now) / 1000) : 0
}
export const rateReset = (key) => buckets.delete(key)

export function clientIp(req) {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (config.trustProxy > 0 && fwd.length) return fwd[Math.max(0, fwd.length - config.trustProxy)]
  return req.socket.remoteAddress || 'unknown'
}

// ---------- cookies ----------
export const COOKIE = config.prod ? '__Host-agrishare' : 'agrishare'
export function parseCookies(req) {
  const out = {}
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}
export const sessionCookie = (value, maxAgeSec) =>
  `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAgeSec}${config.prod ? '; Secure' : ''}`

// ---------- response headers ----------
export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(self), camera=(), microphone=(), payment=()')
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  )
  if (config.prod) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
}

// ---------- TOTP (RFC 6238) for admin two-factor ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export function base32(buf) {
  let bits = '', out = ''
  for (const b of buf) bits += b.toString(2).padStart(8, '0')
  for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]
  return out
}
function unbase32(s) {
  let bits = ''
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += B32.indexOf(c).toString(2).padStart(5, '0')
  const bytes = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
export const newTotpSecret = () => base32(crypto.randomBytes(20))
export function totpAt(secret, step) {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(step))
  const h = crypto.createHmac('sha1', unbase32(secret)).update(msg).digest()
  const o = h[h.length - 1] & 15
  const code = (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000
  return String(code).padStart(6, '0')
}
export function verifyTotp(secret, code) {
  const c = String(code || '').replace(/\s/g, '')
  if (!/^\d{6}$/.test(c)) return false
  const step = Math.floor(Date.now() / 30000)
  return [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(totpAt(secret, step + d)), Buffer.from(c)))
}
export const otpauthUrl = (secret, email) => `otpauth://totp/AgriShare:${encodeURIComponent(email)}?secret=${secret}&issuer=AgriShare`

// ---------- encrypt secrets at rest (AES-256-GCM) ----------
const key = crypto.createHash('sha256').update('agrishare-v1:' + config.secretKey).digest()
export function encrypt(text) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', key, iv)
  const enc = Buffer.concat([c.update(text, 'utf8'), c.final()])
  return [iv, c.getAuthTag(), enc].map((b) => b.toString('base64')).join('.')
}
export function decrypt(blob) {
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'))
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(tag)
  return Buffer.concat([d.update(enc), d.final()]).toString('utf8')
}
