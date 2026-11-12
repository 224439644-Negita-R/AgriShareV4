import { q } from './db.mjs'
import { config } from './config.mjs'
import { haversineKm } from './geo.mjs'
import { TYPE_IMG } from './seed.mjs'
import { fmtRange, todayStr } from './dates.mjs'

export const json = (s, d) => { try { return JSON.parse(s) } catch { return d } }
export const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
const approx = (v) => Math.round(v * 20) / 20 // ~±3 km: exact farm positions are only shown to people who need them
const minKm = (km) => Math.max(1, Math.round(km))

export function userView(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role, location: u.location, province: u.province, lat: u.lat, lng: u.lng,
    radius: u.radius, phone: u.phone, shareContact: !!u.share_contact, verified: !!u.verified, emailVerified: !!u.email_verified,
    totpEnabled: !!u.totp_enabled, needs2faSetup: u.role === 'Admin' && config.requireAdmin2fa && !u.totp_enabled,
    requireVerifiedEmail: config.requireVerifiedEmail, consentVersion: u.consent_version,
    demo: config.seedDemo && !config.prod,
  }
}

/** Contact details other people may see: only when the person has chosen to share them. */
export const contactView = (u) => ({
  id: u.id, name: u.name, initials: initials(u.name), role: u.role, verified: !!u.verified,
  phone: u.share_contact && u.phone ? u.phone : null, email: u.share_contact ? u.email : null,
})

export function ratingFor(e) {
  const r = q.get('SELECT COUNT(*) AS n, COALESCE(SUM(rating),0) AS s FROM reviews WHERE equipment_id = ?', e.id)
  const n = e.base_reviews + r.n
  const avg = n ? ((e.base_rating || 0) * e.base_reviews + r.s) / n : 0
  return { rating: n ? avg.toFixed(1) : 'New', reviews: n }
}

export function blockedDates(equipmentId) {
  const today = todayStr()
  const blocks = q.all('SELECT id, start_date, end_date, note FROM equipment_blocks WHERE equipment_id = ? AND end_date >= ? ORDER BY start_date', equipmentId, today)
    .map((b) => ({ id: b.id, start: b.start_date, end: b.end_date, why: 'blocked', note: b.note }))
  const booked = q.all("SELECT start_date, end_date FROM bookings WHERE equipment_id = ? AND status = 'Confirmed' AND end_date >= ?", equipmentId, today)
    .map((b) => ({ start: b.start_date, end: b.end_date, why: 'booked' }))
  return [...blocks, ...booked].sort((a, b) => a.start.localeCompare(b.start))
}

export function operatorInfo(e) {
  if (e.operator_id) {
    const o = q.get("SELECT * FROM users WHERE id = ? AND role = 'Operator'", e.operator_id)
    if (o) {
      const p = json(o.operator_profile, {})
      return { id: o.id, name: o.name, initials: initials(o.name), verified: !!o.verified, years: p.years || 0, certs: p.certs || '', rating: p.rating || 'New', dayRate: p.dayRate || 0, self: false, phone: o.share_contact && o.phone ? o.phone : null, email: o.share_contact ? o.email : null }
    }
  }
  if (e.operator) return { id: e.owner_id, name: e.owner_name, initials: initials(e.owner_name), verified: !!e.owner_verified, years: 0, certs: 'Operated by the owner', rating: 'New', dayRate: 0, self: true, phone: e.owner_share && e.owner_phone ? e.owner_phone : null, email: e.owner_share ? e.owner_email : null }
  return null
}

export const EQ_SELECT = `SELECT e.*, u.name AS owner_name, u.since AS owner_since, u.phone AS owner_phone, u.email AS owner_email,
  u.share_contact AS owner_share, u.verified AS owner_verified FROM equipment e JOIN users u ON u.id = e.owner_id`

export function getEquipment(id) {
  return q.get(`${EQ_SELECT} WHERE e.id = ?`, Number(id))
}

export function equipmentView(e, viewer, ref, { detail = false } = {}) {
  const images = json(e.images, [])
  const exactOk = viewer.role === 'Admin' || e.owner_id === viewer.id ||
    !!q.get("SELECT 1 AS x FROM bookings WHERE equipment_id = ? AND farmer_id = ? AND status = 'Confirmed'", e.id, viewer.id)
  const lat = exactOk ? e.lat : approx(e.lat), lng = exactOk ? e.lng : approx(e.lng)
  const { rating, reviews } = ratingFor(e)
  const v = {
    id: e.id, name: e.name, type: e.type, place: e.place, province: e.province, lat, lng, exactLocation: exactOk,
    km: ref ? minKm(haversineKm(ref.lat, ref.lng, approx(e.lat), approx(e.lng))) : null,
    rate: e.rate, rating, reviews, img: images[0] || TYPE_IMG[e.type], gallery: images.length ? images : [TYPE_IMG[e.type]],
    operator: !!e.operator, mine: e.owner_id === viewer.id, active: !!e.active,
    saved: !!q.get('SELECT 1 AS x FROM favorites WHERE user_id = ? AND equipment_id = ?', viewer.id, e.id),
    owner: { id: e.owner_id, name: e.owner_name, initials: initials(e.owner_name), since: e.owner_since, verified: !!e.owner_verified,
      phone: e.owner_share && e.owner_phone ? e.owner_phone : null, email: e.owner_share ? e.owner_email : null },
    operatorInfo: operatorInfo(e), specs: json(e.specs, []), description: e.description,
  }
  if (detail) {
    v.blocked = blockedDates(e.id)
    v.recentReviews = q.all(`SELECT r.rating, r.comment, r.created_at, u.name FROM reviews r JOIN users u ON u.id = r.reviewer_id WHERE r.equipment_id = ? ORDER BY r.id DESC LIMIT 5`, e.id)
      .map((r) => ({ rating: r.rating, comment: r.comment, at: r.created_at, name: r.name.split(' ')[0] + ' ' + (r.name.split(' ')[1]?.[0] || '') + '.' }))
  }
  return v
}

const BOOKING_SQL = `SELECT b.*, f.name AS farmer_name, f.phone AS farmer_phone, f.email AS farmer_email, f.share_contact AS farmer_share, f.verified AS farmer_verified,
  e.name AS e_name, e.images, e.type, e.place, e.owner_id, o.name AS owner_name, o.phone AS owner_phone, o.email AS owner_email, o.share_contact AS owner_share, o.verified AS owner_verified,
  EXISTS(SELECT 1 FROM reviews r WHERE r.booking_id = b.id) AS reviewed
  FROM bookings b JOIN users f ON f.id = b.farmer_id JOIN equipment e ON e.id = b.equipment_id JOIN users o ON o.id = e.owner_id`

export function bookingView(id, viewerId) {
  const b = q.get(`${BOOKING_SQL} WHERE b.id = ?`, Number(id))
  const farmerSide = viewerId === b.farmer_id
  const other = farmerSide
    ? { id: b.owner_id, name: b.owner_name, role: 'Equipment Owner', verified: !!b.owner_verified, phone: b.owner_share && b.owner_phone ? b.owner_phone : null, email: b.owner_share ? b.owner_email : null }
    : { id: b.farmer_id, name: b.farmer_name, role: 'Farmer', verified: !!b.farmer_verified, phone: b.farmer_share && b.farmer_phone ? b.farmer_phone : null, email: b.farmer_share ? b.farmer_email : null }
  return {
    id: b.id, ref: 'AS-' + (1000 + b.id),
    equipment: { id: b.equipment_id, name: b.e_name, img: json(b.images, [])[0] || TYPE_IMG[b.type], place: b.place, rate: b.rate, owner: b.owner_name },
    farmer: b.farmer_name, rate: b.rate, startDate: b.start_date, endDate: b.end_date, days: b.days, period: fmtRange(b.start_date, b.end_date),
    estimate: b.estimate, status: b.status, reviewed: !!b.reviewed, createdAt: b.created_at,
    contact: { ...other, initials: initials(other.name) },
  }
}
