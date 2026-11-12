import crypto from 'node:crypto'
import { config } from '../config.mjs'
import { q } from '../db.mjs'
import { route, bad, forbidden, notFound, HttpError, audit, clearCookie } from '../core.mjs'
import { verifyPassword, hashPassword, rateLimit } from '../security.mjs'
import { resolveLocation } from './auth.mjs'
import { userView, json } from '../views.mjs'
import { removeImages, savePrivateImage, deletePrivate } from '../uploads.mjs'
import { todayStr } from '../dates.mjs'

route('GET', '/profile', ({ user }) => userView(user), { setup: true })
route('PUT', '/profile', ({ user, body }) => {
  if (body.role !== undefined && body.role !== user.role) throw forbidden('Account types can only be changed by an administrator')
  const name = body.name === undefined ? user.name : String(body.name).trim()
  if (name.length < 2 || name.length > 80) throw bad('Please enter your full name')
  const phone = body.phone === undefined ? user.phone : String(body.phone).trim().slice(0, 30)
  if (phone && !/^[+\d][\d\s()-]{6,}$/.test(phone)) throw bad('Enter a valid phone number')
  const share = body.shareContact === undefined ? user.share_contact : body.shareContact ? 1 : 0
  const radius = body.radius === undefined ? user.radius : Math.min(100, Math.max(5, Math.round(Number(body.radius)) || 50))
  const loc = resolveLocation(body) || { label: user.location, province: user.province, lat: user.lat, lng: user.lng }
  q.run('UPDATE users SET name=?, phone=?, share_contact=?, radius=?, location=?, province=?, lat=?, lng=? WHERE id=?', name, phone, share, radius, loc.label, loc.province, loc.lat, loc.lng, user.id)
  return userView(q.get('SELECT * FROM users WHERE id = ?', user.id))
})

// ---- POPIA: right of access (export) and deletion ----
route('GET', '/account/export', (ctx) => {
  const u = ctx.user
  audit(ctx, 'data_export', u.id)
  const { pass_hash, totp_secret, ...profile } = u
  return {
    exportedAt: new Date().toISOString(), profile,
    bookingsAsFarmer: q.all('SELECT * FROM bookings WHERE farmer_id = ?', u.id),
    listings: q.all('SELECT id,name,type,place,province,rate,active,created_at FROM equipment WHERE owner_id = ?', u.id),
    reviews: q.all('SELECT * FROM reviews WHERE reviewer_id = ?', u.id),
    reports: q.all('SELECT * FROM reports WHERE reporter_id = ?', u.id),
    notifications: q.all('SELECT title, body, time FROM notifications WHERE user_id = ?', u.id),
    supportTickets: q.all('SELECT message, status, created_at FROM support WHERE user_id = ?', u.id),
    roleChangeRequests: q.all('SELECT current_role, requested_role, reason, status, review_note, created_at, decided_at FROM role_change_requests WHERE user_id = ?', u.id),
    consent: { acceptedAt: u.consent_at, version: u.consent_version },
  }
}, { setup: true, limit: { max: 5, windowMs: 3600_000, by: 'user' } })

route('DELETE', '/account', (ctx) => {
  const u = ctx.user
  if (u.role === 'Admin') throw forbidden('Administrators cannot delete their own account here. Ask another administrator.')
  if (!verifyPassword(String(ctx.body.password || ''), u.pass_hash)) throw bad('Your password is not correct')
  const today = todayStr()
  const active = q.get(`SELECT COUNT(*) AS n FROM bookings b JOIN equipment e ON e.id = b.equipment_id
    WHERE b.status = 'Confirmed' AND b.end_date >= ? AND (b.farmer_id = ? OR e.owner_id = ?)`, today, u.id, u.id).n
  if (active) throw bad('You have confirmed upcoming bookings. Cancel or complete them first.')
  q.run("UPDATE bookings SET status = 'Cancelled', cancelled_by = 'system' WHERE status = 'Pending' AND (farmer_id = ? OR equipment_id IN (SELECT id FROM equipment WHERE owner_id = ?))", u.id, u.id)
  for (const e of q.all('SELECT images FROM equipment WHERE owner_id = ?', u.id)) removeImages(json(e.images, []))
  q.run("UPDATE equipment SET active = 0, images = '[]' WHERE owner_id = ?", u.id)
  for (const v of q.all('SELECT doc_file FROM verification_requests WHERE user_id = ?', u.id)) deletePrivate(v.doc_file)
  for (const t of ['sessions', 'favorites', 'devices', 'notifications', 'one_time_tokens', 'recovery_codes', 'blocks', 'support', 'verification_requests', 'role_change_requests'])
    q.run(`DELETE FROM ${t} WHERE ${t === 'blocks' ? 'blocker_id = ? OR blocked_id' : 'user_id'} = ?`, ...(t === 'blocks' ? [u.id, u.id] : [u.id]))
  q.run(`UPDATE users SET name='Deleted user', email=?, pass_hash=?, phone='', location='Removed', province='Removed', share_contact=0, status='deleted',
         operator_profile=NULL, totp_secret=NULL, totp_enabled=0, verified=0 WHERE id=?`, `deleted-${u.id}@deleted.invalid`, hashPassword(crypto.randomBytes(16).toString('hex')), u.id)
  audit({ ip: ctx.ip }, 'account_deleted', u.id)
  clearCookie(ctx)
  return { ok: true }
}, { limit: { max: 5, windowMs: 3600_000, by: 'user' } })

// ---- devices (phones that receive push notifications) ----
route('POST', '/devices', ({ user, body }) => {
  const token = String(body.token || '')
  if (token.length < 20 || token.length > 400) throw bad('Invalid device token')
  q.run('DELETE FROM devices WHERE token = ?', token)
  q.run('INSERT INTO devices(user_id,token,platform,created_at) VALUES(?,?,?,?)', user.id, token, ['ios', 'android', 'web'].includes(body.platform) ? body.platform : 'android', new Date().toISOString())
  return { ok: true }
})
route('DELETE', '/devices', ({ user, body }) => {
  q.run('DELETE FROM devices WHERE user_id = ? AND token = ?', user.id, String(body.token || ''))
  return { ok: true }
})

// ---- notifications & support ----
route('GET', '/notifications', ({ user }) => ({
  unread: q.get('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read = 0', user.id).n,
  items: q.all('SELECT id,title,body,time,read FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20', user.id).map((n) => ({ ...n, read: !!n.read })),
}), { setup: true })
route('POST', '/notifications/read', ({ user }) => {
  q.run('UPDATE notifications SET read = 1 WHERE user_id = ?', user.id)
  return { ok: true }
}, { setup: true })
route('POST', '/support', ({ user, body }) => {
  const message = String(body.message || '').trim()
  if (!message) throw bad('Tell us how we can help')
  if (message.length > 1000) throw bad('Please keep it under 1000 characters')
  const id = Number(q.run('INSERT INTO support(user_id,message,status,created_at) VALUES(?,?,?,?)', user.id, message, 'open', new Date().toISOString()).lastInsertRowid)
  return { ticket: 'SUP-' + (1000 + id) }
}, { limit: { max: 5, windowMs: 3600_000, by: 'user' } })

// ---- trust & safety: block and report ----
route('GET', '/blocks', ({ user }) => q.all('SELECT u.id, u.name FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = ?', user.id))
route('POST', '/blocks/:id', ({ user, params }) => {
  const target = q.get('SELECT id, role FROM users WHERE id = ?', Number(params.id))
  if (!target || target.id === user.id) throw notFound('User not found')
  if (target.role === 'Admin') throw bad("You can't block an administrator")
  const has = q.get('SELECT 1 AS x FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, target.id)
  if (has) q.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', user.id, target.id)
  else q.run('INSERT INTO blocks(blocker_id,blocked_id) VALUES(?,?)', user.id, target.id)
  return { blocked: !has }
})
const REASONS = ['Misleading or fake listing', 'Unsafe or damaged equipment', 'Scam or payment problem', 'Abusive behaviour', 'Other']
route('POST', '/reports', ({ user, body }) => {
  if (!['listing', 'user'].includes(body.targetType)) throw bad('Unknown report type')
  const exists = body.targetType === 'listing' ? q.get('SELECT id FROM equipment WHERE id = ?', Number(body.targetId)) : q.get('SELECT id FROM users WHERE id = ?', Number(body.targetId))
  if (!exists) throw notFound('Nothing to report')
  if (!REASONS.includes(body.reason)) throw bad('Choose a reason')
  q.run('INSERT INTO reports(reporter_id,target_type,target_id,reason,detail,status,created_at) VALUES(?,?,?,?,?,?,?)', user.id, body.targetType, Number(body.targetId), body.reason, String(body.detail || '').slice(0, 500), 'open', new Date().toISOString())
  return { ok: true }
}, { limit: { max: 10, windowMs: 3600_000, by: 'user' } })

// ---- verification: owners and operators send proof of identity or business ----
route('POST', '/verification', ({ user, body }) => {
  if (user.verified) throw bad('You are already verified')
  if (q.get("SELECT 1 AS x FROM verification_requests WHERE user_id = ? AND status = 'pending'", user.id)) throw bad('You already have a request waiting for review')
  const note = String(body.note || '').trim().slice(0, 500)
  if (!body.document) throw bad('Attach a clear photo of your ID or business registration')
  const file = savePrivateImage(body.document)
  q.run('INSERT INTO verification_requests(user_id,note,doc_file,status,created_at) VALUES(?,?,?,?,?)', user.id, note, file, 'pending', new Date().toISOString())
  return { ok: true }
}, { roles: ['Equipment Owner', 'Operator'], maxBody: 9 * 1024 * 1024, limit: { max: 5, windowMs: 3600_000, by: 'user' } })
route('GET', '/verification/mine', ({ user }) => {
  const v = q.get('SELECT status, reason, created_at FROM verification_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1', user.id)
  return { verified: !!user.verified, latest: v ? { status: v.status, reason: v.reason, at: v.created_at } : null }
}, { roles: ['Equipment Owner', 'Operator'] })

// ---- account type change requests ----
const REQUESTABLE_ROLES = ['Farmer', 'Equipment Owner', 'Operator']

route('GET', '/account-type/request', ({ user }) => {
  const r = q.get('SELECT id, current_role, requested_role, reason, status, review_note, created_at, decided_at FROM role_change_requests WHERE user_id = ? ORDER BY id DESC LIMIT 1', user.id)
  return {
    request: r ? {
      id: r.id,
      currentRole: r.current_role,
      requestedRole: r.requested_role,
      reason: r.reason,
      status: r.status,
      reviewNote: r.review_note,
      createdAt: r.created_at,
      decidedAt: r.decided_at,
    } : null
  }
})

route('POST', '/account-type/request', (ctx) => {
  const { user, body } = ctx
  const requestedRole = String(body.requestedRole || '').trim()
  if (requestedRole === 'Admin') throw bad('You cannot request an Admin account type')
  if (!REQUESTABLE_ROLES.includes(requestedRole)) throw bad('Please select a valid account type')
  if (requestedRole === user.role) throw bad(`You already have a ${user.role} account`)

  const pending = q.get("SELECT 1 AS x FROM role_change_requests WHERE user_id = ? AND status = 'pending'", user.id)
  if (pending) throw bad('You already have an account type change request waiting for admin review')

  const reason = String(body.reason || '').trim().slice(0, 500)
  const id = Number(q.run(
    'INSERT INTO role_change_requests(user_id, current_role, requested_role, reason, status, created_at) VALUES(?,?,?,?,?,?)',
    user.id, user.role, requestedRole, reason, 'pending', new Date().toISOString()
  ).lastInsertRowid)

  audit(ctx, 'role_change_requested', user.id, `${user.role} -> ${requestedRole}`)
  return { ok: true, id }
}, { limit: { max: 10, windowMs: 3600_000, by: 'user' } })

route('POST', '/account-type/request/cancel', (ctx) => {
  const { user } = ctx
  const pending = q.get("SELECT id FROM role_change_requests WHERE user_id = ? AND status = 'pending'", user.id)
  if (!pending) throw bad('No pending request found to cancel')
  q.run("UPDATE role_change_requests SET status = 'cancelled', decided_at = ? WHERE id = ?", new Date().toISOString(), pending.id)
  audit(ctx, 'role_change_cancelled', user.id)
  return { ok: true }
})

