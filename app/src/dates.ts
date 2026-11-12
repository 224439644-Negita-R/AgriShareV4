// Dates are "YYYY-MM-DD" strings in South African time, matching the server.
const SAST = 2 * 3600 * 1000
const toMs = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10))
export const todayStr = () => new Date(Date.now() + SAST).toISOString().slice(0, 10)
export const addDays = (s: string, n: number) => new Date(toMs(s) + n * 86400000).toISOString().slice(0, 10)
export const diffDays = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / 86400000)
export const daysInclusive = (a: string, b: string) => diffDays(a, b) + 1
export const hoursUntil = (s: string) => (toMs(s) - (Date.now() + SAST)) / 3600000
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const p2 = (n: number) => String(n).padStart(2, "0")
export const monthName = (m: number) => FULL[m]
export const ymd = (y: number, m: number, d: number) => `${y}-${p2(m + 1)}-${p2(d)}`
export const longToday = () => {
  const d = new Date(Date.now() + SAST)
  return `${DAYS[d.getUTCDay()]}, ${d.getUTCDate()} ${FULL[d.getUTCMonth()]}`
}
export function fmtDate(s: string) {
  return `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`
}
export function fmtRange(s: string, e: string) {
  if (!s) return ""
  if (!e || s === e) return fmtDate(s)
  const [sy, sm, sd, ey, em, ed] = [+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10), +e.slice(0, 4), +e.slice(5, 7), +e.slice(8, 10)]
  if (sy === ey && sm === em) return `${p2(sd)}–${p2(ed)} ${MON[sm - 1]} ${sy}`
  return `${sd} ${MON[sm - 1]}${sy === ey ? "" : " " + sy} – ${ed} ${MON[em - 1]} ${ey}`
}
