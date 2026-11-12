import { config } from '../config.mjs'
import { q } from '../db.mjs'
import { route, bad, notFound, HttpError, forbidden } from '../core.mjs'
import { equipmentView, bookingView, getEquipment, blockedDates, EQ_SELECT } from '../views.mjs'
import { notify } from '../notify.mjs'
import { todayStr, addDays, daysInclusive, overlaps, isDate } from '../dates.mjs'

const FARMER = ['Farmer']
const OWNER = ['Equipment Owner']

/** Keep statuses honest: finished hires become Completed, requests nobody answered before the start date become Expired. */
export function refreshStatuses() {
  const today = todayStr()
  q.run("UPDATE bookings SET status = 'Completed' WHERE status = 'Confirmed' AND end_date < ?", today)
  q.run("UPDATE bookings SET status = 'Expired' WHERE status = 'Pending' AND start_date < ?", today)
}

function checkDates(start, end) {
  if (!isDate(start) || !isDate(end)) throw bad('Choose your start and end dates')
  if (end < start) throw bad('The end date must be after the start date')
  if (start < todayStr()) throw bad('Start date can not be in the past')
  if (start > addDays(todayStr(), 365)) throw bad('You can book up to a year ahead')
  if (daysInclusive(start, end) > 30) throw bad('Requests are limited to 30 days. Contact the owner for longer hires.')
}
const conflicts = (e, start, end) => blockedDates(e.id).filter((b) => overlaps(start, end, b.start, b.end))

export function createBooking(farmer, e, start, end) {
  checkDates(start, end)
  if (q.get('SELECT 1 AS x FROM blocks WHERE blocker_id = ? AND blocked_id = ?', e.owner_id, farmer.id)) throw forbidden("This owner isn't taking requests from you")
  if (conflicts(e, start, end).length) throw new HttpError(409, 'Those dates are not available. Pick other dates.')
  const dup = q.all("SELECT start_date, end_date FROM bookings WHERE equipment_id = ? AND farmer_id = ? AND status IN ('Pending','Confirmed')", e.id, farmer.id)
  if (dup.some((b) => overlaps(start, end, b.start_date, b.end_date))) throw new HttpError(409, 'You already have a request for those dates')
  const days = daysInclusive(start, end)
  const id = Number(q.run(`INSERT INTO bookings(equipment_id,farmer_id,start_date,end_date,days,rate,estimate,status,created_at)
    VALUES(?,?,?,?,?,?,?,'Pending',?)`, e.id, farmer.id, start, end, days, e.rate, e.rate * days, new Date().toISOString()).lastInsertRowid)
  notify(e.owner_id, 'New booking request', `${farmer.name} wants ${e.name} for ${days} day${days > 1 ? 's' : ''} from ${start}.`, { email: true })
  return id
}

route('GET', '/bookings', ({ user }) => {
  refreshStatuses()
  return q.all('SELECT id FROM bookings WHERE farmer_id = ? ORDER BY created_at DESC', user.id).map((b) => bookingView(b.id, user.id))
}, { roles: FARMER })

route('POST', '/bookings', ({ user, body }) => {
  const e = getEquipment(body.equipmentId)
  if (!e || !e.active) throw notFound('Equipment not found')
  if (e.owner_id === user.id) throw bad("You can't book your own equipment")
  const id = createBooking(user, e, body.startDate, body.endDate)
  notify(user.id, 'Request sent', `Your request for ${e.name} is waiting for ${e.owner_name}.`)
  return bookingView(id, user.id)
}, { roles: FARMER, verified: true, limit: { max: 30, windowMs: 3600_000, by: 'user' } })

const bookingRow = (id) => q.get('SELECT b.*, e.name AS e_name, e.owner_id FROM bookings b JOIN equipment e ON e.id = b.equipment_id WHERE b.id = ?', Number(id))

route('POST', '/bookings/:id/cancel', ({ user, params }) => {
  refreshStatuses()
  const b = bookingRow(params.id)
  if (!b || b.farmer_id !== user.id) throw notFound('Booking not found')
  if (!['Pending', 'Confirmed'].includes(b.status)) throw bad(`A ${b.status.toLowerCase()} booking can't be cancelled`)
  q.run("UPDATE bookings SET status = 'Cancelled', cancelled_by = 'farmer' WHERE id = ?", b.id)
  notify(user.id, 'Booking cancelled', `${b.e_name} was cancelled.`)
  notify(b.owner_id, 'Booking cancelled', `${user.name} cancelled ${b.e_name} (${b.start_date}). Those dates are free again.`, { email: true })
  return bookingView(b.id, user.id)
}, { roles: FARMER })

// ---- reviews (only for finished hires) ----
route('POST', '/bookings/:id/review', ({ user, params, body }) => {
  refreshStatuses()
  const b = bookingRow(params.id)
  if (!b || b.farmer_id !== user.id) throw notFound('Booking not found')
  if (b.status !== 'Completed') throw bad('You can review a hire once it is finished')
  if (q.get('SELECT 1 AS x FROM reviews WHERE booking_id = ?', b.id)) throw bad('You already reviewed this hire')
  const rating = Math.round(Number(body.rating))
  if (!(rating >= 1 && rating <= 5)) throw bad('Choose a rating from 1 to 5')
  q.run('INSERT INTO reviews(booking_id,equipment_id,reviewer_id,rating,comment,created_at) VALUES(?,?,?,?,?,?)', b.id, b.equipment_id, user.id, rating, String(body.comment || '').trim().slice(0, 500), new Date().toISOString())
  notify(b.owner_id, 'New review', `${user.name.split(' ')[0]} rated ${b.e_name} ${rating}/5.`)
  return { ok: true }
}, { roles: FARMER, limit: { max: 20, windowMs: 3600_000, by: 'user' } })

// ---- owner hub ----
route('GET', '/owner/dashboard', ({ user }) => {
  refreshStatuses()
  const ref = { lat: user.lat, lng: user.lng }
  const mine = q.all(`${EQ_SELECT} WHERE e.owner_id = ? ORDER BY e.id DESC`, user.id)
  const reqs = q.all(`SELECT b.id, b.status FROM bookings b JOIN equipment e ON e.id = b.equipment_id WHERE e.owner_id = ?
    ORDER BY (b.status = 'Pending') DESC, b.created_at DESC`, user.id)
  return {
    stats: {
      activeListings: mine.filter((e) => e.active).length,
      pendingRequests: reqs.filter((r) => r.status === 'Pending').length,
      bookedDays: q.get("SELECT COALESCE(SUM(b.days),0) AS n FROM bookings b JOIN equipment e ON e.id = b.equipment_id WHERE e.owner_id = ? AND b.status IN ('Confirmed','Completed')", user.id).n,
      profileViews: mine.reduce((n, e) => n + e.views, 0),
    },
    requests: reqs.map((r) => bookingView(r.id, user.id)),
    equipment: mine.map((e) => ({
      ...equipmentView(e, user, ref, { detail: true }),
      bookings: q.get("SELECT COUNT(*) AS n FROM bookings WHERE equipment_id = ? AND status IN ('Confirmed','Completed')", e.id).n,
    })),
  }
}, { roles: OWNER })

function ownerBooking(user, id) {
  const b = bookingRow(id)
  if (!b || b.owner_id !== user.id) throw notFound('Request not found')
  return b
}
function decide(user, id, approve) {
  refreshStatuses()
  const b = ownerBooking(user, id)
  if (b.status !== 'Pending') throw bad(`This request is already ${b.status.toLowerCase()}`)
  if (approve) {
    const e = getEquipment(b.equipment_id)
    if (conflicts(e, b.start_date, b.end_date).length) throw new HttpError(409, 'Those dates now clash with another booking or a blocked period')
  }
  q.run('UPDATE bookings SET status = ?, decided_at = ? WHERE id = ?', approve ? 'Confirmed' : 'Rejected', new Date().toISOString(), b.id)
  notify(b.farmer_id, approve ? 'Booking approved' : 'Request declined',
    approve ? `${b.e_name} (${b.start_date}) was approved. Contact the owner to arrange payment and collection.` : `${b.e_name} (${b.start_date}) was declined by the owner.`, { email: true })
  return bookingView(b.id, user.id)
}
route('POST', '/owner/requests/:id/approve', ({ user, params }) => decide(user, params.id, true), { roles: OWNER, verified: true })
route('POST', '/owner/requests/:id/decline', ({ user, params }) => decide(user, params.id, false), { roles: OWNER })
route('POST', '/owner/requests/:id/cancel', ({ user, params }) => {
  refreshStatuses()
  const b = ownerBooking(user, params.id)
  if (b.status !== 'Confirmed') throw bad('Only approved bookings can be cancelled here')
  q.run("UPDATE bookings SET status = 'Cancelled', cancelled_by = 'owner' WHERE id = ?", b.id)
  notify(b.farmer_id, 'Booking cancelled by owner', `${b.e_name} (${b.start_date}) was cancelled by the owner. Contact them or look for other equipment.`, { email: true })
  return bookingView(b.id, user.id)
}, { roles: OWNER })

// Demo helper: a seeded farmer requests one of your machines (only exists when demo data is on)
route('POST', '/owner/simulate-request', ({ user }) => {
  if (!config.seedDemo) throw notFound()
  const mine = q.all('SELECT * FROM equipment WHERE owner_id = ? AND active = 1', user.id)
  const farmers = q.all("SELECT * FROM users WHERE role = 'Farmer' AND email LIKE '%@agrishare.demo' AND status = 'active'")
  if (!mine.length) throw bad('List some equipment first')
  for (let tries = 0; tries < 40; tries++) {
    const e = mine[Math.floor(Math.random() * mine.length)]
    const start = addDays(todayStr(), 2 + Math.floor(Math.random() * 40))
    try {
      return bookingView(createBooking(farmers[Math.floor(Math.random() * farmers.length)], e, start, addDays(start, 1)), user.id)
    } catch { /* try other dates */ }
  }
  throw bad('Could not find free dates. Try again.')
}, { roles: OWNER })
