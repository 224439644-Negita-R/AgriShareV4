import crypto from 'node:crypto'
import { config } from '../config.mjs'
import { q } from '../db.mjs'
import { route, bad, forbidden, HttpError, audit, startSession, clearCookie, reportError } from '../core.mjs'
import { hashPassword, verifyPassword, passwordProblem, sha256, randomToken, rateLimit, rateReset, newTotpSecret, verifyTotp, otpauthUrl, encrypt, decrypt } from '../security.mjs'
import { findTown, nearestTown, validCoords } from '../geo.mjs'
import { sendMail, mails } from '../mailer.mjs'
import { notify } from '../notify.mjs'
import { userView } from '../views.mjs'

export const PUBLIC_ROLES = ['Farmer', 'Equipment Owner', 'Operator']
const DUMMY_HASH = hashPassword('not-a-real-password') // so unknown emails cost the same time as real ones

/** Turns {lat,lng,location} from a request into a validated place. GPS wins; otherwise a known town is required. */
export function resolveLocation(body) {
  const hasGps = [body.lat, body.lng].every((v) => v !== undefined && v !== null && v !== '')
  if (hasGps) {
    const lat = Number(body.lat), lng = Number(body.lng)
    if (!validCoords(lat, lng)) throw bad('That position is outside South Africa')
    const n = nearestTown(lat, lng)
    return { label: String(body.location || '').trim().slice(0, 80) || n.label, province: n.province, lat, lng }
  }
  if (body.location !== undefined && String(body.location).trim()) {
    const t = findTown(body.location)
    if (!t) throw bad('Pick your nearest town from the list, or use GPS')
    return { label: t.label, province: t.province, lat: t.lat, lng: t.lng }
  }
  return null
}

function issueToken(userId, kind, hours) {
  const token = randomToken(32)
  q.run('DELETE FROM one_time_tokens WHERE user_id = ? AND kind = ?', userId, kind)
  q.run('INSERT INTO one_time_tokens(user_id,kind,token_hash,expires_at) VALUES(?,?,?,?)', userId, kind, sha256(token), new Date(Date.now() + hours * 3600_000).toISOString())
  return token
}
function consumeToken(token, kind) {
  const t = q.get('SELECT * FROM one_time_tokens WHERE token_hash = ? AND kind = ?', sha256(String(token || '')), kind)
  if (!t || t.used_at || Date.parse(t.expires_at) < Date.now()) throw bad('That link has expired or was already used. Request a new one.')
  q.run('UPDATE one_time_tokens SET used_at = ? WHERE id = ?', new Date().toISOString(), t.id)
  return t
}
function sendVerification(user) {
  const link = `${config.appUrl}/?verify=${issueToken(user.id, 'verify', 24)}`
  return sendMail({ to: user.email, ...mails.verify(link) }).catch((e) => reportError(e, 'verification mail'))
}

route('POST', '/auth/register', async (ctx) => {
  const { body } = ctx
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  if (name.length < 2 || name.length > 80) throw bad('Please enter your full name')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) throw bad('Enter a valid email address')
  const problem = passwordProblem(password, { email, name })
  if (problem) throw bad(problem)
  if (!PUBLIC_ROLES.includes(body.role)) throw bad('Choose how you will use AgriShare')
  if (body.acceptTerms !== true) throw bad('Please accept the Terms and Privacy Policy to continue')
  const loc = resolveLocation(body)
  if (!loc) throw bad('Tell us where you are: pick a town or use GPS')
  if (q.get('SELECT 1 AS x FROM users WHERE email = ?', email)) throw new HttpError(409, 'An account with that email already exists')
  const profile = body.role === 'Operator' ? JSON.stringify({ years: 1, certs: '', skills: [], dayRate: 800, available: true, bio: '', rating: 'New' }) : null
  const now = new Date().toISOString()
  const id = Number(q.run(`INSERT INTO users(name,email,pass_hash,role,location,province,lat,lng,radius,phone,share_contact,status,operator_profile,since,created_at,consent_at,consent_version)
    VALUES(?,?,?,?,?,?,?,?,50,?,1,'active',?,?,?,?,?)`, name, email, hashPassword(password), body.role, loc.label, loc.province, loc.lat, loc.lng,
    String(body.phone || '').trim().slice(0, 30), profile, new Date().getFullYear(), now, now, config.termsVersion).lastInsertRowid)
  const user = q.get('SELECT * FROM users WHERE id = ?', id)
  notify(id, 'Welcome to AgriShare', 'Your account is ready. Confirm your email to unlock bookings and listings.')
  sendVerification(user)
  return { token: startSession(ctx, id), user: userView(user) }
}, { auth: false, limit: { max: 10, windowMs: 3600_000 } })

route('POST', '/auth/login', async (ctx) => {
  const email = String(ctx.body.email || '').trim().toLowerCase()
  const key = `login:${ctx.ip}:${email}`
  const wait = rateLimit(key, 8, 15 * 60_000) || rateLimit('login-ip:' + ctx.ip, 40, 15 * 60_000)
  if (wait) throw new HttpError(429, 'Too many login attempts. Try again in a few minutes.', { retryAfter: wait })
  const u = q.get('SELECT * FROM users WHERE email = ?', email)
  const okPw = verifyPassword(String(ctx.body.password || ''), u ? u.pass_hash : DUMMY_HASH) && !!u
  if (!okPw) {
    if (u?.role === 'Admin') audit({ ip: ctx.ip, user: u }, 'login_failed', u.id)
    throw new HttpError(401, 'Incorrect email or password')
  }
  if (u.status !== 'active') throw new HttpError(403, 'This account has been suspended. Please contact support.')
  if (u.totp_enabled) {
    const code = String(ctx.body.code || '').trim()
    if (!code) return { needs2fa: true }
    let ok = verifyTotp(decrypt(u.totp_secret), code)
    if (!ok) {
      const rc = q.get('SELECT rowid AS rid FROM recovery_codes WHERE user_id = ? AND code_hash = ? AND used_at IS NULL', u.id, sha256(code.toLowerCase()))
      if (rc) {
        q.run('UPDATE recovery_codes SET used_at = ? WHERE rowid = ?', new Date().toISOString(), rc.rid)
        ok = true
        audit({ ip: ctx.ip, user: u }, 'recovery_code_used', u.id)
      }
    }
    if (!ok) throw new HttpError(401, 'That security code is not correct')
  }
  rateReset(key)
  if (u.role === 'Admin') audit({ ip: ctx.ip, user: u }, 'login', u.id)
  return { token: startSession(ctx, u.id), user: userView(u) }
}, { auth: false })

route('POST', '/auth/logout', (ctx) => {
  q.run('DELETE FROM sessions WHERE token_hash = ?', sha256(ctx.token))
  clearCookie(ctx)
  return { ok: true }
}, { auth: false })

route('POST', '/auth/logout-all', (ctx) => {
  q.run('DELETE FROM sessions WHERE user_id = ?', ctx.user.id)
  audit(ctx, 'logout_all', ctx.user.id)
  clearCookie(ctx)
  return { ok: true }
}, { setup: true })

route('POST', '/auth/verify', (ctx) => {
  const t = consumeToken(ctx.body.token, 'verify')
  q.run('UPDATE users SET email_verified = 1 WHERE id = ?', t.user_id)
  return { ok: true }
}, { auth: false, limit: { max: 20, windowMs: 3600_000 } })

route('POST', '/auth/resend-verification', async (ctx) => {
  if (ctx.user.email_verified) return { ok: true }
  await sendVerification(ctx.user)
  return { ok: true }
}, { limit: { max: 3, windowMs: 3600_000, by: 'user' }, setup: true })

route('POST', '/auth/forgot', async (ctx) => {
  const email = String(ctx.body.email || '').trim().toLowerCase()
  if (!rateLimit('forgot:' + email, 3, 3600_000)) {
    const u = q.get("SELECT * FROM users WHERE email = ? AND status = 'active'", email)
    if (u) sendMail({ to: u.email, ...mails.reset(`${config.appUrl}/?reset=${issueToken(u.id, 'reset', 1)}`) }).catch((e) => reportError(e, 'reset mail'))
  }
  return { ok: true } // same answer whether or not the account exists
}, { auth: false, limit: { max: 8, windowMs: 3600_000 } })

route('POST', '/auth/reset', (ctx) => {
  const t = consumeToken(ctx.body.token, 'reset')
  const u = q.get('SELECT * FROM users WHERE id = ?', t.user_id)
  const problem = passwordProblem(String(ctx.body.password || ''), { email: u.email, name: u.name })
  if (problem) {
    q.run('UPDATE one_time_tokens SET used_at = NULL WHERE id = ?', t.id) // let them retry with the same link
    throw bad(problem)
  }
  q.run('UPDATE users SET pass_hash = ?, email_verified = 1 WHERE id = ?', hashPassword(ctx.body.password), u.id)
  q.run('DELETE FROM sessions WHERE user_id = ?', u.id)
  audit({ ip: ctx.ip, user: u }, 'password_reset', u.id)
  notify(u.id, 'Password changed', 'Your password was reset. If this was not you, contact support right away.', { email: true })
  return { ok: true }
}, { auth: false, limit: { max: 10, windowMs: 3600_000 } })

route('POST', '/auth/change-password', (ctx) => {
  const u = ctx.user
  if (!verifyPassword(String(ctx.body.current || ''), u.pass_hash)) throw new HttpError(400, 'Your current password is not correct')
  const problem = passwordProblem(String(ctx.body.password || ''), { email: u.email, name: u.name })
  if (problem) throw bad(problem)
  q.run('UPDATE users SET pass_hash = ? WHERE id = ?', hashPassword(ctx.body.password), u.id)
  q.run('DELETE FROM sessions WHERE user_id = ? AND token_hash != ?', u.id, sha256(ctx.token))
  audit(ctx, 'password_changed', u.id)
  notify(u.id, 'Password changed', 'Your password was changed and other devices were logged out.', { email: true })
  return { ok: true }
}, { limit: { max: 10, windowMs: 3600_000, by: 'user' }, setup: true })

// ---- two-factor (TOTP). Required for admins in production; optional for everyone else ----
route('POST', '/auth/2fa/setup', (ctx) => {
  if (ctx.user.totp_enabled) throw bad('Two-factor is already on')
  const secret = newTotpSecret()
  q.run('UPDATE users SET totp_secret = ? WHERE id = ?', encrypt(secret), ctx.user.id)
  return { secret, otpauth: otpauthUrl(secret, ctx.user.email) }
}, { setup: true, limit: { max: 10, windowMs: 3600_000, by: 'user' } })

route('POST', '/auth/2fa/enable', (ctx) => {
  const u = ctx.user
  if (!u.totp_secret || u.totp_enabled) throw bad('Start the setup first')
  if (!verifyTotp(decrypt(u.totp_secret), ctx.body.code)) throw bad('That code is not correct. Check your phone clock and try again.')
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'))
  q.run('DELETE FROM recovery_codes WHERE user_id = ?', u.id)
  for (const c of codes) q.run('INSERT INTO recovery_codes(user_id,code_hash) VALUES(?,?)', u.id, sha256(c))
  q.run('UPDATE users SET totp_enabled = 1 WHERE id = ?', u.id)
  audit(ctx, '2fa_enabled', u.id)
  return { ok: true, recoveryCodes: codes }
}, { setup: true, limit: { max: 10, windowMs: 3600_000, by: 'user' } })

route('POST', '/auth/2fa/disable', (ctx) => {
  const u = ctx.user
  if (u.role === 'Admin' && config.requireAdmin2fa) throw forbidden('Administrators must keep two-factor on')
  if (!verifyPassword(String(ctx.body.password || ''), u.pass_hash)) throw bad('Your password is not correct')
  if (!u.totp_enabled || !verifyTotp(decrypt(u.totp_secret), ctx.body.code)) throw bad('That security code is not correct')
  q.run('UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?', u.id)
  q.run('DELETE FROM recovery_codes WHERE user_id = ?', u.id)
  audit(ctx, '2fa_disabled', u.id)
  return { ok: true }
}, { setup: true, limit: { max: 10, windowMs: 3600_000, by: 'user' } })
