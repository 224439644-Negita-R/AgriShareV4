// South African towns + geo helpers (offline: no external geocoding service needed).
// Each entry: [town, province, lat, lng]
const RAW = [
  // Western Cape
  ['Stellenbosch', 'Western Cape', -33.9321, 18.8602], ['Paarl', 'Western Cape', -33.7259, 18.9634],
  ['Franschhoek', 'Western Cape', -33.9100, 19.1230], ['Somerset West', 'Western Cape', -34.0757, 18.8433],
  ['Wellington', 'Western Cape', -33.6389, 18.9850], ['Malmesbury', 'Western Cape', -33.4608, 18.7271],
  ['Worcester', 'Western Cape', -33.6450, 19.4440], ['Cape Town', 'Western Cape', -33.9249, 18.4241],
  ['Ceres', 'Western Cape', -33.3700, 19.3100], ['Robertson', 'Western Cape', -33.8033, 19.8850],
  ['Swellendam', 'Western Cape', -34.0226, 20.4417], ['Oudtshoorn', 'Western Cape', -33.5907, 22.2014],
  ['George', 'Western Cape', -33.9631, 22.4617], ['Hermanus', 'Western Cape', -34.4167, 19.2333],
  ['Caledon', 'Western Cape', -34.2294, 19.4264], ['Moorreesburg', 'Western Cape', -33.1539, 18.6608],
  // Gauteng
  ['Pretoria', 'Gauteng', -25.7479, 28.2293], ['Johannesburg', 'Gauteng', -26.2041, 28.0473],
  ['Centurion', 'Gauteng', -25.8603, 28.1894], ['Bronkhorstspruit', 'Gauteng', -25.8077, 28.7451],
  ['Vereeniging', 'Gauteng', -26.6736, 27.9261], ['Randfontein', 'Gauteng', -26.1850, 27.7010],
  // Free State
  ['Bloemfontein', 'Free State', -29.0852, 26.1596], ['Bethlehem', 'Free State', -28.2308, 28.3071],
  ['Kroonstad', 'Free State', -27.6500, 27.2333], ['Bothaville', 'Free State', -27.3833, 26.6167],
  ['Welkom', 'Free State', -27.9770, 26.7350], ['Ficksburg', 'Free State', -28.8667, 27.8833],
  // KwaZulu-Natal
  ['Pietermaritzburg', 'KwaZulu-Natal', -29.6006, 30.3794], ['Durban', 'KwaZulu-Natal', -29.8587, 31.0218],
  ['Greytown', 'KwaZulu-Natal', -29.0631, 30.5897], ['Ladysmith', 'KwaZulu-Natal', -28.5586, 29.7792],
  ['Vryheid', 'KwaZulu-Natal', -27.7695, 30.7917], ['Howick', 'KwaZulu-Natal', -29.4783, 30.2272],
  // Mpumalanga
  ['Mbombela', 'Mpumalanga', -25.4753, 30.9694], ['Middelburg', 'Mpumalanga', -25.7751, 29.4648],
  ['Ermelo', 'Mpumalanga', -26.5333, 29.9833], ['eMalahleni', 'Mpumalanga', -25.8713, 29.2332],
  ['Barberton', 'Mpumalanga', -25.7861, 31.0517],
  // Limpopo
  ['Polokwane', 'Limpopo', -23.9045, 29.4689], ['Tzaneen', 'Limpopo', -23.8333, 30.1667],
  ['Mokopane', 'Limpopo', -24.1944, 29.0097], ['Thohoyandou', 'Limpopo', -22.9456, 30.4850],
  ['Louis Trichardt', 'Limpopo', -23.0433, 29.9051],
  // North West
  ['Rustenburg', 'North West', -25.6676, 27.2421], ['Potchefstroom', 'North West', -26.7145, 27.0970],
  ['Mahikeng', 'North West', -25.8652, 25.6442], ['Lichtenburg', 'North West', -26.1500, 26.1667],
  ['Brits', 'North West', -25.6347, 27.7803],
  // Eastern Cape
  ['Gqeberha', 'Eastern Cape', -33.9608, 25.6022], ['East London', 'Eastern Cape', -33.0153, 27.9116],
  ['Makhanda', 'Eastern Cape', -33.3042, 26.5328], ['Komani', 'Eastern Cape', -31.8976, 26.8753],
  ['Humansdorp', 'Eastern Cape', -34.0270, 24.7693],
  // Northern Cape
  ['Kimberley', 'Northern Cape', -28.7282, 24.7499], ['Upington', 'Northern Cape', -28.4478, 21.2561],
  ['De Aar', 'Northern Cape', -30.6497, 24.0123], ['Kuruman', 'Northern Cape', -27.4524, 23.4326],
  ['Springbok', 'Northern Cape', -29.6643, 17.8865],
]

export const PROVINCES = [...new Set(RAW.map((r) => r[1]))]
export const TOWNS = RAW.map(([town, province, lat, lng]) => ({ town, province, lat, lng, label: `${town}, ${province}` }))
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const BY_LABEL = new Map(TOWNS.map((t) => [norm(t.label), t]))
const BY_TOWN = new Map(TOWNS.map((t) => [norm(t.town), t]))

export const DEFAULT_TOWN = BY_TOWN.get('stellenbosch')

/** Exact match on "Town, Province" or "Town". Returns the town record or null. No fuzzy guessing. */
export function findTown(text) {
  const n = norm(text)
  if (!n) return null
  return BY_LABEL.get(n) || BY_TOWN.get(n.split(',')[0].trim()) || null
}

/** Autocomplete: towns whose name starts with / contains the query, prefix matches first. */
export function searchTowns(text, limit = 8) {
  const n = norm(text)
  if (!n) return TOWNS.slice(0, limit)
  const starts = TOWNS.filter((t) => norm(t.town).startsWith(n))
  const has = TOWNS.filter((t) => !norm(t.town).startsWith(n) && norm(t.label).includes(n))
  return [...starts, ...has].slice(0, limit)
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const rad = (d) => (d * Math.PI) / 180
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export const validCoords = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && lat >= -35.5 && lat <= -21.5 && lng >= 16 && lng <= 33.5

/** Nearest known town to a GPS point, with the distance to it. */
export function nearestTown(lat, lng) {
  let best = null
  for (const t of TOWNS) {
    const d = haversineKm(lat, lng, t.lat, t.lng)
    if (!best || d < best.km) best = { ...t, km: d }
  }
  return best && { ...best, km: Math.round(best.km) }
}
