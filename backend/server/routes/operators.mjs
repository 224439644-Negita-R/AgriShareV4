import { q } from '../db.mjs'
import { route, bad } from '../core.mjs'
import { haversineKm } from '../geo.mjs'
import { json, initials } from '../views.mjs'
import { referencePoint } from './equipment.mjs'

function operatorView(o, ref) {
  const p = json(o.operator_profile, {})
  return {
    id: o.id, name: o.name, initials: initials(o.name), location: o.location, province: o.province, verified: !!o.verified,
    km: ref ? Math.max(1, Math.round(haversineKm(ref.lat, ref.lng, Math.round(o.lat * 20) / 20, Math.round(o.lng * 20) / 20))) : null,
    years: p.years || 0, certs: p.certs || '', skills: p.skills || [], dayRate: p.dayRate || 0, available: !!p.available, bio: p.bio || '', rating: p.rating || 'New',
    phone: o.share_contact && o.phone ? o.phone : null, email: o.share_contact ? o.email : null,
  }
}
route('GET', '/operators', ({ user, query }) => {
  const ref = referencePoint(query, user)
  let list = q.all("SELECT * FROM users WHERE role = 'Operator' AND status = 'active'").map((o) => operatorView(o, ref))
  if (query.province) list = list.filter((o) => o.province === query.province)
  if (query.available === 'true') list = list.filter((o) => o.available)
  if (query.all !== 'true' && query.maxKm) list = list.filter((o) => o.km <= Number(query.maxKm))
  return list.sort((a, b) => a.km - b.km)
}, { roles: ['Farmer', 'Equipment Owner', 'Admin'] })

route('GET', '/operator/profile', ({ user }) => operatorView(user, null), { roles: ['Operator'] })
route('PUT', '/operator/profile', ({ user, body }) => {
  const p = json(user.operator_profile, {})
  if (body.years !== undefined) {
    const y = Number(body.years)
    if (!Number.isFinite(y) || y < 0 || y > 60) throw bad('Enter your years of experience')
    p.years = Math.round(y)
  }
  if (body.dayRate !== undefined) {
    const r = Number(body.dayRate)
    if (!Number.isFinite(r) || r < 100 || r > 20000) throw bad('Enter a day rate between R100 and R20,000')
    p.dayRate = Math.round(r)
  }
  if (body.certs !== undefined) p.certs = String(body.certs).trim().slice(0, 120)
  if (body.bio !== undefined) p.bio = String(body.bio).trim().slice(0, 300)
  if (body.available !== undefined) p.available = !!body.available
  if (body.skills !== undefined) p.skills = (Array.isArray(body.skills) ? body.skills : String(body.skills).split(',')).map((s) => String(s).trim().slice(0, 30)).filter(Boolean).slice(0, 8)
  q.run('UPDATE users SET operator_profile = ? WHERE id = ?', JSON.stringify(p), user.id)
  return operatorView(q.get('SELECT * FROM users WHERE id = ?', user.id), null)
}, { roles: ['Operator'] })
