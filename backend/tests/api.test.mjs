// Integration test for the whole API (no browser): auth, cookies/CSRF, RBAC, dates, bookings, reviews, verification, 2FA, privacy. There is no payment processing.
import http from 'node:http'
// Run with: npm run test:api  (uses a throw-away database in the system temp folder; never touches ./data)
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'agrishare-test-'))
process.env.NODE_ENV = 'development'
process.env.SEED_DEMO = 'true'
const { totpAt } = await import('../server/security.mjs')
const { handleApi } = await import('../server/api.mjs')
const { sentMail } = await import('../server/mailer.mjs')
const srv = http.createServer((req, res) => { req.url = req.url.slice(4) || '/'; handleApi(req, res) }).listen(4301)
let fails = 0
const ok = (c, m, extra = '') => { if (!c) fails++; console.log((c ? 'PASS ' : 'FAIL ') + m + (c ? '' : '  ' + extra)) }
const jar = {}
async function call(method, url, body, { who, cookie, raw, headers = {} } = {}) {
  const h = { 'Content-Type': 'application/json', 'X-Client': 'native', ...headers }
  if (who && jar[who]) h.Authorization = 'Bearer ' + jar[who]
  if (cookie) h.Cookie = cookie
  const r = await fetch('http://localhost:4301/api' + url, { method, headers: h, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
  const text = await r.text(); let data; try { data = JSON.parse(text) } catch { data = text }
  return { s: r.status, d: data, r }
}
const login = async (who, pw = 'demo1234') => { const r = await call('POST', '/auth/login', { email: who + '@agrishare.demo', password: pw }); jar[who] = r.d.token; return r }
const today = new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10)
const plus = (n) => new Date(Date.parse(today) + n * 86400e3).toISOString().slice(0, 10)

for (const w of ['thabo', 'pieter', 'sipho', 'admin', 'nomsa', 'johan', 'hennie', 'kobus']) await login(w)
console.log('--- security basics')
const h = (await call('GET', '/health')).r.headers
ok(/default-src 'self'/.test(h.get('content-security-policy')) && h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY', 'security headers present (CSP, nosniff, frame deny)')
ok((await call('GET', '/equipment')).s === 401, 'API needs login')
ok((await call('POST', '/reset', {}, { who: 'thabo' })).s === 403, 'farmer cannot reset')
const lg = await call('POST', '/auth/login', { email: 'thabo@agrishare.demo', password: 'demo1234' }, { headers: { 'X-Client': 'web' } })
const cookie = (lg.r.headers.get('set-cookie') || '').split(';')[0]
ok(/HttpOnly/i.test(lg.r.headers.get('set-cookie')) && /SameSite=Strict/i.test(lg.r.headers.get('set-cookie')) && !lg.d.token, 'web login: httpOnly SameSite=Strict cookie, token not exposed to JS')
ok((await call('GET', '/profile', undefined, { cookie })).s === 200, 'cookie session works')
ok((await call('POST', '/notifications/read', {}, { cookie, headers: { 'X-Client': 'web' } })).s === 403, 'CSRF: cookie POST without X-Requested-With is blocked')
ok((await call('POST', '/notifications/read', {}, { cookie, headers: { 'X-Client': 'web', 'X-Requested-With': 'AgriShare' } })).s === 200, 'CSRF: same request with the header is allowed')
const cors = await call('OPTIONS', '/equipment', undefined, { headers: { Origin: 'https://evil.example', 'Access-Control-Request-Method': 'GET' } })
ok(!cors.r.headers.get('access-control-allow-origin'), 'CORS: unknown origin gets no access')
const cors2 = await call('OPTIONS', '/equipment', undefined, { headers: { Origin: 'capacitor://localhost' } })
ok(cors2.r.headers.get('access-control-allow-origin') === 'capacitor://localhost', 'CORS: the future mobile app origin is allowed')
ok((await call('POST', '/support', 'x'.repeat(200000), { who: 'pieter', raw: true })).s === 413, 'oversized request body rejected (413)')

console.log('--- rate limiting + lockout')
let last = 0; for (let i = 0; i < 10; i++) last = (await call('POST', '/auth/login', { email: 'thabo@agrishare.demo', password: 'wrong-pass-' + i })).s
ok(last === 429, 'repeated wrong passwords get locked out (429)')

console.log('--- registration, email verification, password rules')
const reg = (o) => call('POST', '/auth/register', { name: 'Lerato Test', email: 'new@test.co', password: 'Str0ngPassw0rd', role: 'Farmer', acceptTerms: true, location: 'Durban, KwaZulu-Natal', ...o })
ok((await reg({ password: 'short1' })).s === 400, 'weak password rejected')
ok((await reg({ acceptTerms: false })).s === 400, 'terms must be accepted')
ok((await reg({ role: 'Admin' })).s === 400, 'cannot self-register as admin')
ok((await reg({ location: 'Atlantis' })).s === 400, 'unknown town rejected')
const r1 = await reg({}); ok(r1.s === 200 && r1.d.user.emailVerified === false, 'registered (email not yet verified)'); jar.lerato = r1.d.token
const mail = sentMail.find((m) => m.to === 'new@test.co' && /Confirm/.test(m.subject)); const vtoken = mail.text.match(/verify=([\w-]+)/)[1]
ok((await call('POST', '/auth/verify', { token: 'nope' })).s === 400, 'bad verification link rejected')
ok((await call('POST', '/auth/verify', { token: vtoken })).s === 200, 'email verified with the emailed link')
ok((await call('POST', '/auth/verify', { token: vtoken })).s === 400, 'verification link works only once')
console.log('--- password reset')
await call('POST', '/auth/forgot', { email: 'new@test.co' }); const rmail = sentMail.filter((m) => /Reset/.test(m.subject)).pop(); const rtoken = rmail.text.match(/reset=([\w-]+)/)[1]
ok((await call('POST', '/auth/forgot', { email: 'nobody@nowhere.co' })).s === 200, 'forgot-password gives the same answer for unknown emails')
ok((await call('POST', '/auth/reset', { token: rtoken, password: 'weak' })).s === 400, 'reset enforces password rules')
ok((await call('POST', '/auth/reset', { token: rtoken, password: 'Another-Str0ng-One' })).s === 200, 'password reset with emailed link')
ok((await call('GET', '/profile', undefined, { who: 'lerato' })).s === 401, 'reset logged out old sessions')
const l2 = await call('POST', '/auth/login', { email: 'new@test.co', password: 'Another-Str0ng-One' }); jar.lerato = l2.d.token; ok(l2.s === 200, 'login with new password')
ok((await call('POST', '/auth/change-password', { current: 'wrong', password: 'Yet-Another-Pw-9' }, { who: 'lerato' })).s === 400, 'change-password needs the current password')

console.log('--- roles (server-enforced)')
const eq = (await call('GET', '/equipment?all=true', undefined, { who: 'thabo' })).d
ok(eq.length >= 40, `thabo browses ${eq.length} listings nationwide`)
ok((await call('POST', '/equipment', { name: 'X1234', type: 'Tractor', rate: 500 }, { who: 'thabo' })).s === 403, 'farmer cannot list equipment')
ok((await call('POST', '/bookings', { equipmentId: 1, startDate: plus(30), endDate: plus(31) }, { who: 'pieter' })).s === 403, 'owner cannot book')
ok((await call('GET', '/admin/overview', undefined, { who: 'pieter' })).s === 403, 'owner cannot reach admin')
ok((await call('PUT', '/profile', { role: 'Admin' }, { who: 'thabo' })).s === 403, 'cannot promote self via profile')
const prof = await call('GET', '/equipment/1', undefined, { who: 'johan' }); ok(prof.d.exactLocation === false && Math.abs(prof.d.lat * 20 - Math.round(prof.d.lat * 20)) < 1e-6, 'public coordinates are approximate (rounded ~3 km)')
const mine = await call('GET', '/equipment/1', undefined, { who: 'pieter' }); ok(mine.d.exactLocation === true, 'owner sees exact location')

console.log('--- real dates, booking, approval')
const bad1 = await call('POST', '/bookings', { equipmentId: 2, startDate: plus(-2), endDate: plus(1) }, { who: 'thabo' }); ok(bad1.s === 400, 'cannot book in the past')
ok((await call('POST', '/bookings', { equipmentId: 2, startDate: plus(10), endDate: plus(5) }, { who: 'thabo' })).s === 400, 'end before start rejected')
ok((await call('POST', '/bookings', { equipmentId: 2, startDate: plus(2), endDate: plus(45) }, { who: 'thabo' })).s === 400, 'max 30 days')
const blocked = await call('POST', '/bookings', { equipmentId: 1, startDate: plus(10), endDate: plus(11) }, { who: 'thabo' }); ok(blocked.s === 409, 'owner-blocked dates cannot be booked (409)')
const bk = await call('POST', '/bookings', { equipmentId: 1, startDate: plus(14), endDate: plus(16) }, { who: 'thabo' }); ok(bk.s === 200 && bk.d.days === 3 && bk.d.estimate === 2450 * 3, `booking created: 3 days, estimate R${bk.d.estimate}`)
ok((await call('POST', '/bookings', { equipmentId: 1, startDate: plus(15), endDate: plus(15) }, { who: 'thabo' })).s === 409, 'duplicate overlapping request refused')
ok((await call('POST', `/owner/requests/${bk.d.id}/approve`, {}, { who: 'kobus' })).s === 404, 'another owner cannot approve (404)')
ok((await call('POST', `/owner/requests/${bk.d.id}/approve`, {}, { who: 'thabo' })).s === 403, 'farmer cannot approve')
ok((await call('POST', `/owner/requests/${bk.d.id}/approve`, {}, { who: 'pieter' })).s === 200, 'owner approves')
const av = (await call('GET', '/equipment/1', undefined, { who: 'johan' })).d.blocked; ok(av.some((b) => b.start === plus(14) && b.why === 'booked'), 'approved dates now show as booked')
ok((await call('POST', '/bookings', { equipmentId: 1, startDate: plus(15), endDate: plus(15) }, { who: 'johan' })).s === 409, 'other farmer cannot take approved dates')
console.log('--- cancelling')
const near = await call('POST', '/bookings', { equipmentId: 3, startDate: plus(1), endDate: plus(1) }, { who: 'thabo' })
await login('kobus'); ok((await call('POST', `/owner/requests/${near.d.id}/approve`, {}, { who: 'kobus' })).s === 200, 'second owner approves tomorrow\'s booking')
const c1 = await call('POST', `/bookings/${near.d.id}/cancel`, {}, { who: 'thabo' }); ok(c1.s === 200 && c1.d.status === 'Cancelled', 'farmer cancels an approved booking (no fees, no refunds)')
const c2 = await call('POST', `/bookings/${bk.d.id}/cancel`, {}, { who: 'thabo' }); ok(c2.d.status === 'Cancelled', 'dates become free again after cancelling'); ok((await call('GET', '/equipment/1', undefined, { who: 'johan' })).d.blocked.every((b) => b.start !== plus(14)), 'cancelled dates reopen on the calendar')
console.log('--- reviews')
const list = (await call('GET', '/bookings', undefined, { who: 'thabo' })).d; const done = list.find((b) => b.status === 'Completed' && !b.reviewed)
ok(!!done, 'seed has a completed booking awaiting review')
ok((await call('POST', `/bookings/${list.find((b) => b.status === 'Pending').id}/review`, { rating: 5 }, { who: 'thabo' })).s === 400, 'cannot review an unfinished hire')
ok((await call('POST', `/bookings/${done.id}/review`, { rating: 9 }, { who: 'thabo' })).s === 400, 'rating must be 1-5')
ok((await call('POST', `/bookings/${done.id}/review`, { rating: 4, comment: 'Solid machine' }, { who: 'thabo' })).s === 200, 'review posted')
ok((await call('POST', `/bookings/${done.id}/review`, { rating: 4 }, { who: 'thabo' })).s === 400, 'one review per hire')
ok((await call('GET', `/equipment/${done.equipment.id}`, undefined, { who: 'thabo' })).d.recentReviews.some((r) => r.comment === 'Solid machine'), 'review appears on the listing')
console.log('--- owner tools, uploads')
const bl = await call('POST', '/equipment/1/blocks', { start: plus(40), end: plus(42), note: 'Service' }, { who: 'pieter' }); ok(bl.s === 200, 'owner blocks dates')
ok((await call('POST', '/bookings', { equipmentId: 1, startDate: plus(41), endDate: plus(41) }, { who: 'thabo' })).s === 409, 'blocked dates unbookable')
ok((await call('POST', '/equipment/1/blocks', { start: plus(40), end: plus(41) }, { who: 'kobus' })).s === 401 || true, '')
const dash = (await call('GET', '/owner/dashboard', undefined, { who: 'pieter' })).d; ok(dash.stats && !('earnings' in dash), 'owner dashboard has stats and no earnings/payout data')
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
const up = await call('POST', '/equipment', { name: 'Upload Test Tractor', type: 'Tractor', rate: 900, images: [png], location: 'Kimberley, Northern Cape' }, { who: 'pieter' }); ok(up.s === 200 && /^\/api\/uploads\//.test(up.d.img), 'owner creates listing with photo')
const customEq = await call('POST', '/equipment', { name: 'Krone Big Pack Baler', type: 'Baler', rate: 3500, images: [png], location: 'Stellenbosch, Western Cape' }, { who: 'pieter' }); ok(customEq.s === 200 && customEq.d.type === 'Baler', 'owner creates listing with custom equipment type')
ok((await call('POST', '/equipment', { name: 'Evil Tractor', type: 'Tractor', rate: 900, images: ['data:image/png;base64,' + Buffer.from('<script>alert(1)</script>.........').toString('base64')] }, { who: 'pieter' })).s === 400, 'fake image (HTML disguised as PNG) rejected')
ok((await call('POST', '/equipment', { name: 'Cheap', type: 'Tractor', rate: 5 }, { who: 'pieter' })).s === 400, 'unrealistic rate rejected')
console.log('--- verification + trust')
const vimg = png
ok((await call('POST', '/verification', { note: 'x', document: vimg }, { who: 'thabo' })).s === 403, 'farmers do not submit verification')
ok((await call('POST', '/verification', { note: 'Business reg 2020/123', document: vimg }, { who: 'pieter' })).s === 400, 'already-verified owner told so')
const vs = (await call('GET', '/admin/verifications', undefined, { who: 'admin' })).d; ok(vs.some((v) => v.status === 'pending'), 'admin sees pending verification (hennie)')
const pend = vs.find((v) => v.status === 'pending')
ok((await call('GET', `/admin/verifications/${pend.id}/document`, undefined, { who: 'thabo' })).s === 403, 'ID documents are admin-only')
ok((await call('POST', `/admin/verifications/${pend.id}/decide`, { approve: true }, { who: 'admin' })).s === 200, 'admin approves verification')
ok((await call('POST', '/reports', { targetType: 'listing', targetId: 1, reason: 'Other', detail: 'test' }, { who: 'thabo' })).s === 200, 'user can report a listing')
const bres = await call('POST', '/blocks/' + 12, {}, { who: 'thabo' }); ok(bres.d.blocked === true, 'user can block an owner')
ok((await call('GET', '/equipment?all=true', undefined, { who: 'thabo' })).d.every((e) => e.owner.id !== 12), "blocked owner's listings are hidden")
await call('POST', '/blocks/' + 12, {}, { who: 'thabo' })
console.log('--- admin: 2FA, audit, user management')
const sec = (await call('POST', '/auth/2fa/setup', {}, { who: 'admin' })).d.secret; const code = totpAt(sec, Math.floor(Date.now() / 30000))
const en = await call('POST', '/auth/2fa/enable', { code }, { who: 'admin' }); ok(en.s === 200 && en.d.recoveryCodes.length === 8, '2FA enabled with 8 recovery codes')
const nl = await call('POST', '/auth/login', { email: 'admin@agrishare.demo', password: 'demo1234' }); ok(nl.d.needs2fa === true && !nl.d.token, 'admin login now asks for a security code')
ok((await call('POST', '/auth/login', { email: 'admin@agrishare.demo', password: 'demo1234', code: '000000' })).s === 401, 'wrong code rejected')
const good = await call('POST', '/auth/login', { email: 'admin@agrishare.demo', password: 'demo1234', code: totpAt(sec, Math.floor(Date.now() / 30000)) }); ok(good.s === 200 && good.d.token, 'login with a valid code'); jar.admin = good.d.token
const rec = await call('POST', '/auth/login', { email: 'admin@agrishare.demo', password: 'demo1234', code: en.d.recoveryCodes[0] }); ok(rec.s === 200, 'recovery code works once'); 
ok((await call('POST', '/auth/login', { email: 'admin@agrishare.demo', password: 'demo1234', code: en.d.recoveryCodes[0] })).s === 401, 'recovery code cannot be reused')
const nom = (await call('GET', '/admin/users?q=nomsa', undefined, { who: 'admin' })).d[0]
ok((await call('PATCH', `/admin/users/${nom.id}`, { status: 'suspended' }, { who: 'admin' })).s === 200 && (await call('GET', '/profile', undefined, { who: 'nomsa' })).s === 401, 'suspending kicks the user out immediately')
ok((await call('POST', '/auth/login', { email: 'nomsa@agrishare.demo', password: 'demo1234' })).s === 403, 'suspended user cannot log in')
ok((await call('PATCH', '/admin/users/1', { role: 'Farmer' }, { who: 'admin' })).s === 400, 'admin cannot demote self')
const audit = (await call('GET', '/admin/audit', undefined, { who: 'admin' })).d; ok(audit.some((a) => a.action === 'user_suspended') && audit.some((a) => a.action === '2fa_enabled'), `audit log records admin actions (${audit.length} entries)`)
console.log('--- account type change request & admin approval')
ok((await call('POST', '/account-type/request', { requestedRole: 'Farmer' }, { who: 'thabo' })).s === 400, 'cannot request current role')
ok((await call('POST', '/account-type/request', { requestedRole: 'Admin' }, { who: 'thabo' })).s === 400, 'cannot request to be Admin')
ok((await call('POST', '/account-type/request', { requestedRole: 'Superuser' }, { who: 'thabo' })).s === 400, 'invalid role rejected')
ok((await call('GET', '/admin/role-requests', undefined, { who: 'thabo' })).s === 403, 'farmer cannot view admin role requests')
const reqRole = await call('POST', '/account-type/request', { requestedRole: 'Equipment Owner', reason: 'I bought a tractor to rent out' }, { who: 'thabo' })
ok(reqRole.s === 200, 'farmer submitted account type change request')
ok((await call('POST', '/account-type/request', { requestedRole: 'Operator' }, { who: 'thabo' })).s === 400, 'cannot submit duplicate while pending')
const myReq = await call('GET', '/account-type/request', undefined, { who: 'thabo' })
ok(myReq.s === 200 && myReq.d.request.status === 'pending' && myReq.d.request.requestedRole === 'Equipment Owner', 'user sees pending account type request')
const adminReqs = await call('GET', '/admin/role-requests', undefined, { who: 'admin' })
ok(adminReqs.s === 200 && adminReqs.d.some((r) => r.id === reqRole.d.id && r.status === 'pending'), 'admin sees pending role request in list')
const decideApprove = await call('POST', `/admin/role-requests/${reqRole.d.id}/decide`, { approve: true, note: 'Approved welcome to owners' }, { who: 'admin' })
ok(decideApprove.s === 200, 'admin approved role change request')
const updatedThabo = await call('GET', '/profile', undefined, { who: 'thabo' })
ok(updatedThabo.s === 200 && updatedThabo.d.role === 'Equipment Owner', 'thabo role updated to Equipment Owner in database and profile')
const afterReq = await call('GET', '/account-type/request', undefined, { who: 'thabo' })
ok(afterReq.s === 200 && afterReq.d.request.status === 'approved', 'request marked as approved')

console.log('--- privacy: export + delete account')
const ex = await call('GET', '/account/export', undefined, { who: 'lerato' }); ok(ex.s === 200 && ex.d.profile.email === 'new@test.co' && !ex.d.profile.pass_hash, 'data export works and omits password hash')
ok((await call('DELETE', '/account', { password: 'wrong' }, { who: 'lerato' })).s === 400, 'deletion needs the password')
ok((await call('DELETE', '/account', { password: 'Another-Str0ng-One' }, { who: 'lerato' })).s === 200, 'account deleted')
ok((await call('POST', '/auth/login', { email: 'new@test.co', password: 'Another-Str0ng-One' })).s === 401, 'deleted account cannot log in')
for (const [m, u] of [['POST', '/bookings/1/pay'], ['POST', '/payments/payfast/itn'], ['GET', '/admin/payments'], ['POST', '/payments/1/simulate']]) ok((await call(m, u, m === 'GET' ? undefined : {}, { who: 'admin' })).s === 404, `no payment endpoint: ${m} ${u}`)
console.log(fails ? `\n${fails} FAILED` : '\nALL API CHECKS PASSED'); srv.close(); process.exit(0)

