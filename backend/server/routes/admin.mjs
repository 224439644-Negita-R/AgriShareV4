import { q } from '../db.mjs'
import { route, bad, forbidden, notFound, audit, HttpError } from '../core.mjs'
import { PROVINCES } from '../geo.mjs'
import { bookingView, getEquipment, json } from '../views.mjs'
import { removeImages, readPrivate, deletePrivate } from '../uploads.mjs'
import { notify } from '../notify.mjs'
import { refreshStatuses } from './bookings.mjs'

const ADMIN = ['Admin']
const ROLES = ['Farmer', 'Equipment Owner', 'Operator', 'Admin']
const adminCount = () => q.get("SELECT COUNT(*) AS n FROM users WHERE role = 'Admin' AND status = 'active'").n
const get = (_m, p, h) => route('GET', p, h, { roles: ADMIN })

get('GET', '/admin/overview', () => {
  refreshStatuses()
  return {
    users: {
      total: q.get("SELECT COUNT(*) AS n FROM users WHERE status != 'deleted'").n,
      byRole: Object.fromEntries(ROLES.map((r) => [r, q.get("SELECT COUNT(*) AS n FROM users WHERE role = ? AND status != 'deleted'", r).n])),
      suspended: q.get("SELECT COUNT(*) AS n FROM users WHERE status = 'suspended'").n,
    },
    listings: { total: q.get('SELECT COUNT(*) AS n FROM equipment').n, active: q.get('SELECT COUNT(*) AS n FROM equipment WHERE active = 1').n },
    bookings: Object.fromEntries(q.all('SELECT status, COUNT(*) AS n FROM bookings GROUP BY status').map((r) => [r.status, r.n])),
    openTickets: q.get("SELECT COUNT(*) AS n FROM support WHERE status = 'open'").n,
    openReports: q.get("SELECT COUNT(*) AS n FROM reports WHERE status = 'open'").n,
    pendingVerifications: q.get("SELECT COUNT(*) AS n FROM verification_requests WHERE status = 'pending'").n,
    pendingRoleRequests: q.get("SELECT COUNT(*) AS n FROM role_change_requests WHERE status = 'pending'").n,
    byProvince: PROVINCES.map((p) => ({
      province: p,
      users: q.get("SELECT COUNT(*) AS n FROM users WHERE province = ? AND status != 'deleted'", p).n,
      listings: q.get('SELECT COUNT(*) AS n FROM equipment WHERE province = ?', p).n,
    })),
  }
})

// ---- users ----
get('GET', '/admin/users', ({ query }) => {
  const where = ["status != 'deleted'"]
  const args = []
  if (query.role) (where.push('role = ?'), args.push(query.role))
  const text = (query.q || '').trim().toLowerCase().slice(0, 60).replace(/[%_]/g, '')
  if (text) (where.push("lower(name || ' ' || email || ' ' || location) LIKE ?"), args.push('%' + text + '%'))
  return q.all(`SELECT * FROM users WHERE ${where.join(' AND ')} ORDER BY role, name LIMIT 200`, ...args).map((u) => ({
    id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, location: u.location, province: u.province, since: u.since,
    verified: !!u.verified, emailVerified: !!u.email_verified, twoFactor: !!u.totp_enabled,
    listings: q.get('SELECT COUNT(*) AS n FROM equipment WHERE owner_id = ?', u.id).n,
    bookings: q.get('SELECT COUNT(*) AS n FROM bookings WHERE farmer_id = ?', u.id).n,
    pendingRole: q.get("SELECT requested_role FROM role_change_requests WHERE user_id = ? AND status = 'pending'", u.id)?.requested_role || null,
  }))
})
route('PATCH', '/admin/users/:id', (ctx) => {
  const { user, params, body } = ctx
  const u = q.get("SELECT * FROM users WHERE id = ? AND status != 'deleted'", Number(params.id))
  if (!u) throw notFound('User not found')
  if (u.id === user.id) throw bad("You can't change your own role or status")
  if (body.role !== undefined) {
    if (!ROLES.includes(body.role)) throw bad('Unknown role')
    if (u.role === 'Admin' && body.role !== 'Admin' && adminCount() <= 1) throw bad('There must be at least one administrator')
    q.run('UPDATE users SET role = ? WHERE id = ?', body.role, u.id)
    if (body.role !== 'Equipment Owner') q.run('UPDATE equipment SET active = 0 WHERE owner_id = ?', u.id)
    if (body.role === 'Operator' && !u.operator_profile)
      q.run('UPDATE users SET operator_profile = ? WHERE id = ?', JSON.stringify({ years: 1, certs: '', skills: [], dayRate: 800, available: true, bio: '', rating: 'New' }), u.id)
    q.run("UPDATE role_change_requests SET status = 'approved', review_note = 'Updated directly by admin', reviewer_id = ?, decided_at = ? WHERE user_id = ? AND status = 'pending'", user.id, new Date().toISOString(), u.id)
    q.run('DELETE FROM sessions WHERE user_id = ?', u.id) // new permissions apply from the next login
    audit(ctx, 'role_changed', u.id, `${u.role} -> ${body.role}`)
    notify(u.id, 'Account type changed', `An administrator changed your account type to ${body.role}. Please log in again.`, { email: true })
  }
  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status)) throw bad('Unknown status')
    if (body.status === 'suspended' && u.role === 'Admin' && adminCount() <= 1) throw bad('There must be at least one administrator')
    q.run('UPDATE users SET status = ? WHERE id = ?', body.status, u.id)
    if (body.status === 'suspended') q.run('DELETE FROM sessions WHERE user_id = ?', u.id)
    audit(ctx, body.status === 'suspended' ? 'user_suspended' : 'user_reactivated', u.id)
  }
  if (body.verified !== undefined) {
    q.run('UPDATE users SET verified = ? WHERE id = ?', body.verified ? 1 : 0, u.id)
    audit(ctx, body.verified ? 'verified_set' : 'verified_removed', u.id)
  }
  return { ok: true }
}, { roles: ADMIN })
route('DELETE', '/admin/users/:id', (ctx) => {
  const u = q.get("SELECT * FROM users WHERE id = ? AND status != 'deleted'", Number(ctx.params.id))
  if (!u) throw notFound('User not found')
  if (u.id === ctx.user.id) throw bad("You can't delete your own account")
  if (u.role === 'Admin' && adminCount() <= 1) throw bad('There must be at least one administrator')
  if (q.get('SELECT 1 AS x FROM bookings b JOIN equipment e ON e.id = b.equipment_id WHERE b.farmer_id = ? OR e.owner_id = ?', u.id, u.id))
    throw bad('This account has booking history that must be kept. Suspend it instead.')
  for (const e of q.all('SELECT images FROM equipment WHERE owner_id = ?', u.id)) removeImages(json(e.images, []))
  for (const v of q.all('SELECT doc_file FROM verification_requests WHERE user_id = ?', u.id)) deletePrivate(v.doc_file)
  q.run('DELETE FROM role_change_requests WHERE user_id = ?', u.id)
  q.run('DELETE FROM users WHERE id = ?', u.id)
  audit(ctx, 'user_deleted', u.id, u.role)
  return { ok: true }
}, { roles: ADMIN })

// ---- listings ----
get('GET', '/admin/equipment', ({ query }) => {
  const where = ['1=1']
  const args = []
  if (query.province) (where.push('e.province = ?'), args.push(query.province))
  return q.all(`SELECT e.id, e.name, e.type, e.place, e.province, e.rate, e.active, u.name AS owner FROM equipment e JOIN users u ON u.id = e.owner_id WHERE ${where.join(' AND ')} ORDER BY e.province, e.name LIMIT 300`, ...args).map((e) => ({ ...e, active: !!e.active }))
})
route('PATCH', '/admin/equipment/:id', (ctx) => {
  const e = getEquipment(ctx.params.id)
  if (!e) throw notFound('Listing not found')
  q.run('UPDATE equipment SET active = ? WHERE id = ?', ctx.body.active ? 1 : 0, e.id)
  audit(ctx, ctx.body.active ? 'listing_restored' : 'listing_hidden', e.id, e.name)
  notify(e.owner_id, ctx.body.active ? 'Listing restored' : 'Listing hidden', `An administrator ${ctx.body.active ? 'restored' : 'hid'} "${e.name}".`)
  return { ok: true }
}, { roles: ADMIN })
route('DELETE', '/admin/equipment/:id', (ctx) => {
  const e = getEquipment(ctx.params.id)
  if (!e) throw notFound('Listing not found')
  if (q.get('SELECT 1 AS x FROM bookings WHERE equipment_id = ?', e.id)) {
    q.run('UPDATE equipment SET active = 0 WHERE id = ?', e.id)
    audit(ctx, 'listing_hidden', e.id, e.name + ' (has bookings, kept)')
    return { ok: true, hidden: true }
  }
  q.run('DELETE FROM equipment WHERE id = ?', e.id)
  removeImages(json(e.images, []))
  audit(ctx, 'listing_deleted', e.id, e.name)
  notify(e.owner_id, 'Listing removed', `An administrator removed "${e.name}".`)
  return { ok: true }
}, { roles: ADMIN })

get('GET', '/admin/bookings', ({ user }) => {
  refreshStatuses()
  return q.all('SELECT id FROM bookings ORDER BY created_at DESC LIMIT 60').map((b) => bookingView(b.id, user.id))
})

// ---- verification ----
get('GET', '/admin/verifications', () =>
  q.all(`SELECT v.id, v.note, v.status, v.reason, v.created_at, v.doc_file IS NOT NULL AS has_doc, u.name, u.email, u.role, u.location FROM verification_requests v
         JOIN users u ON u.id = v.user_id ORDER BY (v.status = 'pending') DESC, v.id DESC LIMIT 100`).map((v) => ({ ...v, has_doc: !!v.has_doc })))
route('GET', '/admin/verifications/:id/document', (ctx) => {
  const v = q.get('SELECT doc_file FROM verification_requests WHERE id = ?', Number(ctx.params.id))
  const bytes = v && readPrivate(v.doc_file)
  if (!bytes) throw notFound('No document')
  audit(ctx, 'verification_document_viewed', ctx.params.id)
  const ext = v.doc_file.split('.').pop()
  return { __bytes: bytes, type: { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] }
}, { roles: ADMIN })
route('POST', '/admin/verifications/:id/decide', (ctx) => {
  const v = q.get("SELECT * FROM verification_requests WHERE id = ? AND status = 'pending'", Number(ctx.params.id))
  if (!v) throw notFound('Request not found')
  const approve = !!ctx.body.approve
  q.run('UPDATE verification_requests SET status = ?, reason = ?, reviewer_id = ?, decided_at = ? WHERE id = ?', approve ? 'approved' : 'rejected', String(ctx.body.reason || '').slice(0, 200), ctx.user.id, new Date().toISOString(), v.id)
  if (approve) q.run('UPDATE users SET verified = 1 WHERE id = ?', v.user_id)
  deletePrivate(v.doc_file) // keep ID documents no longer than needed
  q.run('UPDATE verification_requests SET doc_file = NULL WHERE id = ?', v.id)
  audit(ctx, approve ? 'verification_approved' : 'verification_rejected', v.user_id)
  notify(v.user_id, approve ? 'You are verified' : 'Verification not approved', approve ? 'Your account now shows the verified badge.' : `We could not verify you: ${ctx.body.reason || 'please resubmit a clearer document'}.`, { email: true })
  return { ok: true }
}, { roles: ADMIN })

// ---- account type change requests ----
get('GET', '/admin/role-requests', () =>
  q.all(`SELECT r.id, r.user_id, r.current_role, r.requested_role, r.reason, r.status, r.review_note, r.created_at, r.decided_at,
                u.name, u.email, u.location, u.province, u.role AS user_current_role
         FROM role_change_requests r
         JOIN users u ON u.id = r.user_id
         ORDER BY (r.status = 'pending') DESC, r.id DESC LIMIT 100`)
)
route('POST', '/admin/role-requests/:id/decide', (ctx) => {
  const req = q.get("SELECT * FROM role_change_requests WHERE id = ? AND status = 'pending'", Number(ctx.params.id))
  if (!req) throw notFound('Request not found or already decided')
  const targetUser = q.get("SELECT * FROM users WHERE id = ? AND status != 'deleted'", req.user_id)
  if (!targetUser) throw notFound('User not found')

  const approve = !!ctx.body.approve
  const note = String(ctx.body.note || ctx.body.reason || '').trim().slice(0, 300)

  if (approve) {
    if (!ROLES.includes(req.requested_role)) throw bad('Invalid requested role')
    if (targetUser.role === 'Admin' && req.requested_role !== 'Admin' && adminCount() <= 1) {
      throw bad('There must be at least one administrator')
    }
    q.run('UPDATE users SET role = ? WHERE id = ?', req.requested_role, targetUser.id)
    if (req.requested_role !== 'Equipment Owner') {
      q.run('UPDATE equipment SET active = 0 WHERE owner_id = ?', targetUser.id)
    }
    if (req.requested_role === 'Operator' && !targetUser.operator_profile) {
      q.run('UPDATE users SET operator_profile = ? WHERE id = ?', JSON.stringify({ years: 1, certs: '', skills: [], dayRate: 800, available: true, bio: '', rating: 'New' }), targetUser.id)
    }
    q.run("UPDATE role_change_requests SET status = 'approved', review_note = ?, reviewer_id = ?, decided_at = ? WHERE id = ?", note, ctx.user.id, new Date().toISOString(), req.id)
    audit(ctx, 'role_change_approved', targetUser.id, `${req.current_role} -> ${req.requested_role}`)
    notify(targetUser.id, 'Account type updated', `An administrator approved your request to change your account type to ${req.requested_role}.`, { email: true })
  } else {
    q.run("UPDATE role_change_requests SET status = 'rejected', review_note = ?, reviewer_id = ?, decided_at = ? WHERE id = ?", note, ctx.user.id, new Date().toISOString(), req.id)
    audit(ctx, 'role_change_rejected', targetUser.id, note || `${req.current_role} -> ${req.requested_role}`)
    notify(targetUser.id, 'Account type request not approved', `Your request to change your account type to ${req.requested_role} was not approved${note ? ': ' + note : '.'}`, { email: true })
  }
  return { ok: true }
}, { roles: ADMIN })

// ---- reports, tickets, audit log ----
get('GET', '/admin/reports', () =>
  q.all(`SELECT r.id, r.target_type, r.target_id, r.reason, r.detail, r.status, r.created_at, u.name AS reporter,
         CASE r.target_type WHEN 'listing' THEN (SELECT name FROM equipment WHERE id = r.target_id) ELSE (SELECT name FROM users WHERE id = r.target_id) END AS target_name
         FROM reports r JOIN users u ON u.id = r.reporter_id ORDER BY (r.status = 'open') DESC, r.id DESC LIMIT 100`))
route('PATCH', '/admin/reports/:id', (ctx) => {
  if (!['open', 'resolved'].includes(ctx.body.status)) throw bad('Unknown status')
  q.run('UPDATE reports SET status = ? WHERE id = ?', ctx.body.status, Number(ctx.params.id))
  audit(ctx, 'report_' + ctx.body.status, ctx.params.id)
  return { ok: true }
}, { roles: ADMIN })
get('GET', '/admin/tickets', () =>
  q.all("SELECT s.id, s.message, s.status, s.created_at, u.name, u.email, u.role FROM support s JOIN users u ON u.id = s.user_id ORDER BY (s.status = 'open') DESC, s.id DESC LIMIT 100").map((t) => ({ ...t, ref: 'SUP-' + (1000 + t.id) })))
route('PATCH', '/admin/tickets/:id', (ctx) => {
  if (!['open', 'resolved'].includes(ctx.body.status)) throw bad('Unknown status')
  q.run('UPDATE support SET status = ? WHERE id = ?', ctx.body.status, Number(ctx.params.id))
  return { ok: true }
}, { roles: ADMIN })
get('GET', '/admin/audit', () =>
  q.all('SELECT a.id, a.action, a.target, a.detail, a.ip, a.created_at, u.name AS actor FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 150'))
