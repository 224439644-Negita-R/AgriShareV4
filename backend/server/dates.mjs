// Dates are plain "YYYY-MM-DD" strings in South African time (UTC+2, no daylight saving).
const SAST = 2 * 3600 * 1000
export const todayStr = () => new Date(Date.now() + SAST).toISOString().slice(0, 10)
const toMs = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
export const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(toMs(s)).toISOString().slice(0, 10) === s
export const addDays = (s, n) => new Date(toMs(s) + n * 86400000).toISOString().slice(0, 10)
export const diffDays = (a, b) => Math.round((toMs(b) - toMs(a)) / 86400000) // b - a
export const daysInclusive = (start, end) => diffDays(start, end) + 1
export const overlaps = (aS, aE, bS, bE) => aS <= bE && aE >= bS
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const p2 = (n) => String(n).padStart(2, '0')
export function fmtRange(s, e) {
  const [sy, sm, sd] = [+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10)]
  const [ey, em, ed] = [+e.slice(0, 4), +e.slice(5, 7), +e.slice(8, 10)]
  if (s === e) return `${p2(sd)} ${MON[sm - 1]} ${sy}`
  if (sy === ey && sm === em) return `${p2(sd)}–${p2(ed)} ${MON[sm - 1]} ${sy}`
  return `${p2(sd)} ${MON[sm - 1]}${sy === ey ? '' : ' ' + sy} – ${p2(ed)} ${MON[em - 1]} ${ey}`
}
/** Hours from now until 00:00 of the given date (South African time). Negative when already started. */
export const hoursUntil = (dateStr) => (toMs(dateStr) - (Date.now() + SAST)) / 3600000
