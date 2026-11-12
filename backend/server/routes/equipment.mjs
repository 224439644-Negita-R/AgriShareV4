import { q, tx } from '../db.mjs'
import { route, bad, forbidden, notFound, MAX_IMAGES, audit } from '../core.mjs'
import { findTown, validCoords, nearestTown } from '../geo.mjs'
import { resolveLocation } from './auth.mjs'
import { equipmentView, getEquipment, EQ_SELECT, json, initials } from '../views.mjs'
import { saveImages, removeImages } from '../uploads.mjs'
import { TYPE_IMG } from '../seed.mjs'
import { notify } from '../notify.mjs'
import { isDate, todayStr, overlaps, addDays } from '../dates.mjs'

export const TYPES = ['Tractor', 'Harvester', 'Planter', 'Irrigation']

export function referencePoint(query, user) {
  const lat = Number(query.lat), lng = Number(query.lng)
  if (query.lat !== undefined && query.lat !== '' && validCoords(lat, lng)) return { lat, lng }
  if (query.location) {
    const t = findTown(query.location)
    if (t) return { lat: t.lat, lng: t.lng }
  }
  return { lat: user.lat, lng: user.lng }
}

route('GET', '/categories', () => {
  const custom = q.all("SELECT DISTINCT type FROM equipment WHERE active = 1 AND type NOT IN ('Tractor', 'Harvester', 'Planter', 'Irrigation')").map((r) => r.type)
  const types = [...TYPES, ...custom]
  return types.map((type) => ({ type, count: q.get("SELECT COUNT(*) AS n FROM equipment e JOIN users u ON u.id = e.owner_id WHERE e.type = ? AND e.active = 1 AND u.status = 'active'", type).n })).filter((c) => c.count > 0 || TYPES.includes(c.type))
})

route('GET', '/equipment', ({ user, query }) => {
  const where = ["e.active = 1", "u.status = 'active'", 'e.owner_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)']
  const args = [user.id]
  if (query.type && query.type !== 'All') (where.push('e.type = ?'), args.push(query.type))
  if (query.operator === 'true') where.push('e.operator = 1')
  if (query.saved === 'true') (where.push('e.id IN (SELECT equipment_id FROM favorites WHERE user_id = ?)'), args.push(user.id))
  if (query.province) (where.push('e.province = ?'), args.push(query.province))
  const text = (query.q || '').trim().toLowerCase().slice(0, 60)
  if (text) (where.push("lower(e.name || ' ' || e.type || ' ' || e.place) LIKE ?"), args.push('%' + text.replace(/[%_]/g, '') + '%'))
  const ref = referencePoint(query, user)
  let items = q.all(`${EQ_SELECT} WHERE ${where.join(' AND ')}`, ...args).map((e) => equipmentView(e, user, ref))
  if (query.all !== 'true') {
    const r = query.maxKm !== undefined && query.maxKm !== '' ? Number(query.maxKm) : user.radius
    if (Number.isFinite(r) && r > 0) items = items.filter((x) => x.km <= r)
  }
  const sorters = { 'price-asc': (a, b) => a.rate - b.rate, 'price-desc': (a, b) => b.rate - a.rate }
  items.sort(sorters[query.sort] || ((a, b) => a.km - b.km || a.id - b.id))
  if (query.limit) items = items.slice(0, Math.max(1, Number(query.limit) | 0))
  return items
})

route('GET', '/equipment/:id', ({ user, params, query }) => {
  const e = getEquipment(params.id)
  if (!e || (!e.active && e.owner_id !== user.id && user.role !== 'Admin')) throw notFound('Equipment not found')
  if (e.owner_id !== user.id) q.run('UPDATE equipment SET views = views + 1 WHERE id = ?', e.id)
  return equipmentView(e, user, referencePoint(query, user), { detail: true })
})

route('POST', '/equipment', ({ user, body }) => {
  const name = String(body.name || '').trim()
  const rate = Number(body.rate)
  if (name.length < 3 || name.length > 80) throw bad('Please give the equipment a name (3 to 80 characters)')
  const type = String(body.type || '').trim()
  if (!type || type.length < 2 || type.length > 50) throw bad('Choose or enter an equipment type (2 to 50 characters)')
  if (!Number.isFinite(rate) || rate < 50 || rate > 200000) throw bad('Enter a daily rate between R50 and R200,000')
  const loc = resolveLocation(body) || { label: user.location, province: user.province, lat: user.lat, lng: user.lng }
  let operatorId = null
  if (body.operatorId) {
    const o = q.get("SELECT id FROM users WHERE id = ? AND role = 'Operator' AND status = 'active'", Number(body.operatorId))
    if (!o) throw bad('That operator is not available')
    operatorId = o.id
  }
  const images = saveImages(body.images)
  const id = Number(q.run(`INSERT INTO equipment(owner_id,name,type,place,province,lat,lng,rate,base_reviews,operator,operator_id,specs,description,images,created_at)
    VALUES(?,?,?,?,?,?,?,?,0,?,?,?,?,?,?)`, user.id, name, type, loc.label, loc.province, loc.lat, loc.lng, Math.round(rate), operatorId || body.operator ? 1 : 0, operatorId,
    JSON.stringify([['—', 'Engine power'], ['—', 'Drivetrain'], ['New', 'Listing']]),
    String(body.description || '').trim().slice(0, 1000) || 'Newly listed equipment. Contact the owner for details.',
    JSON.stringify(images.length ? images : [TYPE_IMG[type] || TYPE_IMG.Tractor]), new Date().toISOString()).lastInsertRowid)
  notify(user.id, 'Listing published', `${name} is now live at R${Math.round(rate).toLocaleString()} / day in ${loc.label}.`)
  return equipmentView(getEquipment(id), user, { lat: user.lat, lng: user.lng })
}, { roles: ['Equipment Owner'], verified: true, maxBody: MAX_IMAGES, limit: { max: 20, windowMs: 3600_000, by: 'user' } })

function own(user, id) {
  const e = getEquipment(id)
  if (!e) throw notFound('Listing not found')
  if (e.owner_id !== user.id) throw forbidden('That listing belongs to someone else')
  return e
}
route('PATCH', '/equipment/:id', ({ user, params, body }) => {
  const e = own(user, params.id)
  if (body.active !== undefined) q.run('UPDATE equipment SET active = ? WHERE id = ?', body.active ? 1 : 0, e.id)
  if (body.rate !== undefined) {
    const r = Number(body.rate)
    if (!Number.isFinite(r) || r < 50 || r > 200000) throw bad('Enter a daily rate between R50 and R200,000')
    q.run('UPDATE equipment SET rate = ? WHERE id = ?', Math.round(r), e.id) // existing bookings keep the rate they were made at
  }
  return equipmentView(getEquipment(e.id), user, { lat: user.lat, lng: user.lng }, { detail: true })
}, { roles: ['Equipment Owner'] })

route('DELETE', '/equipment/:id', ({ user, params }) => {
  const e = own(user, params.id)
  if (q.get("SELECT 1 AS x FROM bookings WHERE equipment_id = ? AND status = 'Confirmed' AND end_date >= ?", e.id, todayStr())) throw bad('This listing has confirmed bookings. Cancel them first, or pause the listing instead.')
  if (q.get('SELECT 1 AS x FROM bookings WHERE equipment_id = ?', e.id)) {
    q.run('UPDATE equipment SET active = 0 WHERE id = ?', e.id) // booking history must be kept
    return { ok: true, hidden: true }
  }
  q.run('DELETE FROM equipment WHERE id = ?', e.id)
  removeImages(json(e.images, []))
  return { ok: true }
}, { roles: ['Equipment Owner'] })

// ---- owner blocks dates (own use, maintenance) ----
route('POST', '/equipment/:id/blocks', ({ user, params, body }) => {
  const e = own(user, params.id)
  const { start, end } = body
  if (!isDate(start) || !isDate(end) || end < start) throw bad('Choose a valid start and end date')
  if (start < todayStr() || end > addDays(todayStr(), 400)) throw bad('Dates must be within the next year')
  if (q.all("SELECT start_date, end_date FROM bookings WHERE equipment_id = ? AND status = 'Confirmed'", e.id).some((b) => overlaps(start, end, b.start_date, b.end_date)))
    throw new HttpError(409, 'Those dates overlap a confirmed booking')
  const id = Number(q.run('INSERT INTO equipment_blocks(equipment_id,start_date,end_date,note) VALUES(?,?,?,?)', e.id, start, end, String(body.note || '').slice(0, 100)).lastInsertRowid)
  return { id }
}, { roles: ['Equipment Owner'], limit: { max: 60, windowMs: 3600_000, by: 'user' } })
route('DELETE', '/equipment/:id/blocks/:blockId', ({ user, params }) => {
  const e = own(user, params.id)
  q.run('DELETE FROM equipment_blocks WHERE id = ? AND equipment_id = ?', Number(params.blockId), e.id)
  return { ok: true }
}, { roles: ['Equipment Owner'] })

route('POST', '/equipment/:id/favorite', ({ user, params }) => {
  const e = getEquipment(params.id)
  if (!e) throw notFound('Equipment not found')
  const has = q.get('SELECT 1 AS x FROM favorites WHERE user_id = ? AND equipment_id = ?', user.id, e.id)
  if (has) q.run('DELETE FROM favorites WHERE user_id = ? AND equipment_id = ?', user.id, e.id)
  else q.run('INSERT INTO favorites(user_id,equipment_id) VALUES(?,?)', user.id, e.id)
  return { id: e.id, saved: !has }
}, { roles: ['Farmer'] })

import { HttpError } from '../core.mjs'
