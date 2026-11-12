import { config } from '../config.mjs'
import { route, bad } from '../core.mjs'
import { PROVINCES, TOWNS, searchTowns, nearestTown, validCoords } from '../geo.mjs'
import { rateLimit } from '../security.mjs'

const tv = ({ label, town, province, lat, lng }) => ({ label, town, province, lat, lng })
const cache = new Map()

/** Optional free-text address search (farm names, villages) through OpenStreetMap Nominatim. Off unless GEOCODER=nominatim. */
async function remoteSearch(text) {
  const key = text.toLowerCase()
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.items
  if (rateLimit('nominatim', 1, 1100)) return [] // Nominatim's policy: at most 1 request per second
  try {
    const u = new URL('https://nominatim.openstreetmap.org/search')
    u.search = new URLSearchParams({ q: text, format: 'jsonv2', countrycodes: 'za', addressdetails: '1', limit: '5' }).toString()
    const r = await fetch(u, { headers: { 'User-Agent': `AgriShare/1.0 (${config.appUrl})` }, signal: AbortSignal.timeout(3000) })
    if (!r.ok) return []
    const items = (await r.json())
      .map((x) => ({ lat: +x.lat, lng: +x.lon, name: x.name || x.display_name.split(',')[0], state: x.address?.state }))
      .filter((x) => validCoords(x.lat, x.lng))
      .map((x) => {
        const province = PROVINCES.includes(x.state) ? x.state : nearestTown(x.lat, x.lng).province
        return { label: `${x.name}, ${province}`, town: x.name, province, lat: x.lat, lng: x.lng }
      })
    cache.set(key, { items, exp: Date.now() + 86400_000 })
    return items
  } catch {
    return []
  }
}

route('GET', '/config', () => ({ demo: config.seedDemo && !config.prod, termsVersion: config.termsVersion }), { auth: false })
route('GET', '/geo/provinces', () => PROVINCES, { auth: false })
route('GET', '/geo/towns', async ({ query }) => {
  const text = String(query.q || '').slice(0, 80)
  const local = searchTowns(text, Math.min(20, Number(query.limit) || 8)).map(tv)
  if (config.geocoder === 'nominatim' && text.length >= 4 && local.length < 3) return [...local, ...(await remoteSearch(text))]
  return local
}, { auth: false, limit: { max: 120, windowMs: 60_000 } })
const POPULAR = ['Cape Town', 'Stellenbosch', 'Pretoria', 'Johannesburg', 'Bloemfontein', 'Durban', 'Pietermaritzburg', 'Polokwane', 'Mbombela', 'Rustenburg', 'Gqeberha', 'Kimberley']
route('GET', '/geo/popular', ({ query }) => {
  const list = query.province ? TOWNS.filter((t) => t.province === query.province) : POPULAR.map((n) => TOWNS.find((t) => t.town === n))
  return list.slice(0, 12).map(tv)
}, { auth: false })
route('GET', '/geo/reverse', ({ query }) => {
  const lat = Number(query.lat), lng = Number(query.lng)
  if (!validCoords(lat, lng)) throw bad('That position is outside South Africa')
  const n = nearestTown(lat, lng)
  return { label: n.km <= 3 ? n.label : `Near ${n.label}`, town: n.town, province: n.province, distanceKm: n.km, lat, lng }
}, { auth: false, limit: { max: 60, windowMs: 60_000 } })
