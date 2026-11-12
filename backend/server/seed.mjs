// Demo data: only created when SEED_DEMO is on (development). Dates are relative to today so the demo never goes stale.
import { findTown } from './geo.mjs'
import { config } from './config.mjs'
import { q } from './db.mjs'
import { hashPassword } from './security.mjs'
import { addDays, daysInclusive, todayStr } from './dates.mjs'

export const DEMO_PASSWORD = 'demo1234'
const IMG = {
  Tractor: ['https://images.unsplash.com/photo-1598652122968-27595453e0fb?auto=format&fit=crop&w=1000&q=72', 'https://images.unsplash.com/photo-1633551216917-42c1ffc44e6a?auto=format&fit=crop&w=1000&q=72'],
  Harvester: ['https://images.unsplash.com/photo-1687150575667-70b5e8c3f9cc?auto=format&fit=crop&w=1000&q=72', 'https://images.unsplash.com/photo-1598652122968-27595453e0fb?auto=format&fit=crop&w=1000&q=72'],
  Planter: ['https://images.unsplash.com/photo-1518620487713-c328b89c0423?auto=format&fit=crop&w=1000&q=72', 'https://images.unsplash.com/photo-1598652122968-27595453e0fb?auto=format&fit=crop&w=1000&q=72'],
  Irrigation: ['https://images.unsplash.com/photo-1633551216917-42c1ffc44e6a?auto=format&fit=crop&w=1000&q=72', 'https://images.unsplash.com/photo-1518620487713-c328b89c0423?auto=format&fit=crop&w=1000&q=72'],
}
export const TYPE_IMG = { Tractor: IMG.Tractor[0], Harvester: IMG.Harvester[0], Planter: IMG.Planter[0], Irrigation: IMG.Irrigation[0] }
const iso = (daysAgo = 0) => new Date(Date.now() + daysAgo * 86400000).toISOString()

// [key, name, role, town, since, verified]
const USERS = [
  ['admin', 'Admin User', 'Admin', 'Pretoria', 2020, 1],
  ['thabo', 'Thabo Mokoena', 'Farmer', 'Stellenbosch', 2023, 0], ['johan', 'Johan van Wyk', 'Farmer', 'Paarl', 2020, 0],
  ['nomsa', 'Nomsa Dlamini', 'Farmer', 'Pretoria', 2021, 0], ['lerato', 'Lerato Molefe', 'Farmer', 'Bloemfontein', 2022, 0],
  ['sizwe', 'Sizwe Ndaba', 'Farmer', 'Pietermaritzburg', 2021, 0], ['annelie', 'Annelie Smit', 'Farmer', 'Potchefstroom', 2019, 0],
  ['botha', 'Pieter Botha', 'Farmer', 'Polokwane', 2022, 0], ['zanele', 'Zanele Nkosi', 'Farmer', 'Mbombela', 2023, 0],
  ['kagiso', 'Kagiso Mahlangu', 'Farmer', 'Gqeberha', 2021, 0], ['riaan', 'Riaan Pretorius', 'Farmer', 'Kimberley', 2020, 0],
  ['pieter', 'Pieter Marais', 'Equipment Owner', 'Stellenbosch', 2021, 1], ['kobus', 'Kobus Visser', 'Equipment Owner', 'Paarl', 2019, 1],
  ['hendrik', 'Hendrik Louw', 'Equipment Owner', 'Worcester', 2022, 1], ['marthinus', 'Marthinus Fourie', 'Equipment Owner', 'Malmesbury', 2018, 1],
  ['francois', 'Francois du Toit', 'Equipment Owner', 'Oudtshoorn', 2020, 1], ['willem', 'Willem Jacobs', 'Equipment Owner', 'Centurion', 2019, 1],
  ['mpho', 'Mpho Sithole', 'Equipment Owner', 'Bronkhorstspruit', 2021, 1], ['hennie', 'Hennie Nel', 'Equipment Owner', 'Bloemfontein', 2018, 0],
  ['gerrit', 'Gerrit Steyn', 'Equipment Owner', 'Bethlehem', 2020, 1], ['thulani', 'Thulani Zulu', 'Equipment Owner', 'Greytown', 2022, 1],
  ['ayanda', 'Ayanda Mkhize', 'Equipment Owner', 'Durban', 2021, 1], ['howick', 'Bongani Cele', 'Equipment Owner', 'Howick', 2023, 0],
  ['charl', 'Charl Venter', 'Equipment Owner', 'Middelburg', 2019, 1], ['lindiwe', 'Lindiwe Sibiya', 'Equipment Owner', 'Barberton', 2022, 0],
  ['dumisani', 'Dumisani Baloyi', 'Equipment Owner', 'Tzaneen', 2021, 1], ['andries', 'Andries Coetzee', 'Equipment Owner', 'Rustenburg', 2018, 1],
  ['hannes', 'Hannes Roux', 'Equipment Owner', 'Potchefstroom', 2019, 1], ['nokuthula', 'Nokuthula Mbeki', 'Equipment Owner', 'East London', 2020, 1],
  ['jaco', 'Jaco Botes', 'Equipment Owner', 'Humansdorp', 2021, 1], ['danie', 'Danie Kruger', 'Equipment Owner', 'Upington', 2017, 1],
  ['dineo', 'Dineo Radebe', 'Equipment Owner', 'Kimberley', 2022, 1],
  ['sipho', 'Sipho Mthembu', 'Operator', 'Stellenbosch', 2021, 1], ['thandi', 'Thandi Ndlovu', 'Operator', 'Paarl', 2020, 1],
  ['maria', 'Maria Botha', 'Operator', 'Pretoria', 2019, 1], ['jacques', 'Jacques Pienaar', 'Operator', 'Bloemfontein', 2021, 1],
  ['tebogo', 'Tebogo Maseko', 'Operator', 'Polokwane', 2022, 0], ['xolani', 'Xolani Dube', 'Operator', 'Pietermaritzburg', 2020, 1],
  ['elna', 'Elna Joubert', 'Operator', 'Kimberley', 2018, 1], ['bheki', 'Bheki Ngcobo', 'Operator', 'Durban', 2023, 0],
]
const OPS = {
  sipho: [8, 'Tractor & harvester certified', ['Tractors', 'Vineyards', 'Ploughing'], 850, 1, 'Experienced vineyard and orchard operator.', '4.9'],
  thandi: [11, 'Combine harvester certified', ['Combines', 'Grain', 'Baling'], 1100, 1, 'Harvest specialist for wheat, barley and canola.', '4.8'],
  maria: [9, 'Tractor & planter certified', ['Planting', 'Tractors', 'Maize'], 900, 1, 'Precision planting for maize and sunflower.', '4.7'],
  jacques: [14, 'Combine & tractor certified', ['Combines', 'Maize', 'Soya'], 1200, 1, 'Large-scale grain harvesting across the Free State.', '4.9'],
  tebogo: [6, 'Tractor certified', ['Tractors', 'Citrus', 'Spraying'], 780, 0, 'Orchard operator, currently booked until January.', '4.6'],
  xolani: [10, 'Tractor & cane harvester certified', ['Sugar cane', 'Tractors', 'Hauling'], 950, 1, 'Cane and timber hauling operator.', '4.8'],
  elna: [12, 'Irrigation systems certified', ['Centre pivots', 'Tractors', 'Lucerne'], 1000, 1, 'Pivot installation, calibration and operation.', '4.9'],
  bheki: [5, 'Tractor certified', ['Tractors', 'Ploughing'], 700, 1, 'Reliable all-round operator.', '4.5'],
}
const SPECS = {
  Tractor: (i) => [[`${60 + ((i * 11) % 70)} HP`, 'Engine power'], [i % 3 ? '4WD' : '2WD', 'Drivetrain'], [`${(900 + i * 337) % 4800} h`, 'Usage']],
  Harvester: (i) => [[`${160 + ((i * 13) % 160)} HP`, 'Engine power'], ['4WD', 'Drivetrain'], [`${(1800 + i * 411) % 5200} h`, 'Usage']],
  Planter: (i) => [[`${4 + (i % 3) * 2} rows`, 'Configuration'], ['Pneumatic', 'Seed metering'], ['Fertiliser', 'Attachment']],
  Irrigation: (i) => [[`${200 + ((i * 53) % 300)} m`, 'Span length'], ['Electric', 'Drive'], [`${20 + ((i * 7) % 40)} ha`, 'Coverage']],
}
const DESC = {
  Tractor: 'A dependable, well-maintained tractor for ploughing, planting and hauling. Serviced before every season.',
  Harvester: 'Reliable harvester for grain and oilseed crops. Header included; serviced before every harvest.',
  Planter: 'Precision planter for maize, sunflower and soya. Calibrated this season.',
  Irrigation: 'Efficient irrigation system with remote control, suited to lucerne, potatoes and vegetables.',
}
// [owner, name, type, rate, rating, reviews, operator (key | 'self' | null)]
const EQUIP = [
  ['pieter', 'John Deere 5075E', 'Tractor', 2450, 4.9, 28, 'sipho'], ['pieter', 'Gaspardo 8-Row Planter', 'Planter', 1400, 4.6, 9, null],
  ['kobus', 'New Holland TC5.30', 'Harvester', 4800, 4.8, 16, 'thandi'], ['kobus', 'Kubota M7060', 'Tractor', 2200, 4.7, 11, null],
  ['hendrik', 'Landini Solis 90', 'Tractor', 1850, 4.7, 21, null], ['hendrik', 'Valley Centre Pivot', 'Irrigation', 3200, 4.8, 12, 'self'],
  ['marthinus', 'Massey Ferguson 290', 'Tractor', 2100, 4.9, 34, null], ['marthinus', 'Claas Dominator 108', 'Harvester', 5200, 4.6, 8, 'thandi'],
  ['francois', 'Fendt 312 Vario', 'Tractor', 3100, 4.9, 15, null], ['francois', 'Netafim Drip System', 'Irrigation', 900, 4.5, 6, null],
  ['willem', 'John Deere 6120M', 'Tractor', 2900, 4.8, 19, 'maria'], ['willem', 'Monosem NG Plus 6-Row', 'Planter', 1650, 4.7, 10, null],
  ['mpho', 'Massey Ferguson 5710', 'Tractor', 2350, 4.6, 14, null], ['mpho', 'Reinke Centre Pivot', 'Irrigation', 3400, 4.7, 9, 'self'],
  ['hennie', 'Case IH Magnum 340', 'Tractor', 4200, 4.9, 24, 'jacques'], ['hennie', 'Amazone Precision Planter', 'Planter', 1800, 4.8, 13, null],
  ['gerrit', 'Claas Lexion 560', 'Harvester', 7200, 4.9, 22, 'jacques'], ['gerrit', 'Case IH Farmall 110', 'Tractor', 2250, 4.7, 17, null],
  ['thulani', 'New Holland TD5.110', 'Tractor', 2150, 4.6, 13, 'xolani'], ['thulani', 'Great Plains No-Till Drill', 'Planter', 1500, 4.8, 7, null],
  ['ayanda', 'Cameco CH2500 Cane Harvester', 'Harvester', 6500, 4.7, 10, 'xolani'], ['ayanda', 'Mahindra 8050', 'Tractor', 1950, 4.5, 8, 'bheki'],
  ['howick', 'Deutz-Fahr 5105', 'Tractor', 2050, 4.6, 9, null],
  ['charl', 'Deutz-Fahr 5115', 'Tractor', 2300, 4.7, 12, null], ['charl', 'John Deere S660', 'Harvester', 6800, 4.8, 18, null],
  ['lindiwe', 'Landini Rex 100', 'Tractor', 1900, 4.5, 6, null], ['lindiwe', 'Gaspardo Maschio Planter', 'Planter', 1350, 4.4, 5, null],
  ['dumisani', 'Kubota M5-111', 'Tractor', 2050, 4.5, 8, 'tebogo'], ['dumisani', 'Hose-reel Irrigator', 'Irrigation', 750, 4.4, 5, null],
  ['andries', 'New Holland T7.210', 'Tractor', 3300, 4.9, 20, null], ['andries', 'John Deere 1755 Planter', 'Planter', 1900, 4.7, 11, null],
  ['hannes', 'Deutz-Fahr Agrotron 120', 'Tractor', 2400, 4.7, 14, null], ['hannes', 'Massey Ferguson Beta 7360', 'Harvester', 5400, 4.6, 9, 'self'],
  ['nokuthula', 'Mahindra 7050', 'Tractor', 1750, 4.4, 6, null], ['nokuthula', 'Lindsay Zimmatic Pivot', 'Irrigation', 3000, 4.6, 7, null],
  ['jaco', 'Case IH Puma 150', 'Tractor', 2800, 4.8, 15, null], ['jaco', 'Hardi Boom Irrigation Rig', 'Irrigation', 1100, 4.3, 4, null],
  ['danie', 'Massey Ferguson 6713', 'Tractor', 2600, 4.8, 16, 'elna'], ['danie', 'Valmont Centre Pivot', 'Irrigation', 3500, 4.7, 10, 'elna'],
  ['dineo', 'John Deere 5090E', 'Tractor', 2300, 4.6, 8, null], ['dineo', 'Lindsay Pivot 400m', 'Irrigation', 3100, 4.7, 6, 'elna'],
]
// dates the owner blocked, as day offsets from today
const BLOCKS = [[[10, 11], [25, 27]], [[1, 2], [20, 22]], [[16, 17]], [[28, 29]], [[12, 13]], [], [[26, 27]], [[30, 31]]]
// [equipment, farmer, startOffset, endOffset, status]
const BOOKINGS = [
  ['John Deere 5075E', 'thabo', 5, 7, 'Confirmed', 1], ['New Holland TC5.30', 'thabo', 12, 14, 'Pending', 0],
  ['Landini Solis 90', 'thabo', -46, -45, 'Completed', 1], ['Massey Ferguson 290', 'thabo', -21, -20, 'Rejected', 0],
  ['Gaspardo 8-Row Planter', 'johan', 8, 11, 'Pending', 0], ['John Deere 5075E', 'johan', 20, 21, 'Pending', 0],
  ['Claas Lexion 560', 'lerato', 3, 5, 'Confirmed', 1], ['Case IH Magnum 340', 'lerato', 10, 11, 'Pending', 0],
  ['John Deere 6120M', 'nomsa', 9, 10, 'Confirmed', 0], ['Monosem NG Plus 6-Row', 'nomsa', 15, 16, 'Pending', 0],
  ['Massey Ferguson 5710', 'nomsa', -34, -33, 'Completed', 1], ['New Holland TD5.110', 'sizwe', 1, 3, 'Confirmed', 1],
  ['Deutz-Fahr 5105', 'sizwe', -31, -31, 'Completed', 1], ['Deutz-Fahr Agrotron 120', 'annelie', 8, 9, 'Pending', 0],
  ['Kubota M5-111', 'botha', 5, 6, 'Confirmed', 0], ['Landini Rex 100', 'zanele', 14, 16, 'Pending', 0],
  ['Case IH Puma 150', 'kagiso', 3, 4, 'Confirmed', 1], ['John Deere 5090E', 'riaan', 18, 19, 'Pending', 0],
]
const TICKETS = [
  ['thabo', 'I cannot see my confirmed booking on my phone.', 'open'],
  ['kobus', 'How do I pause one of my listings during the harvest?', 'resolved'],
  ['lerato', 'Can I change the dates on a pending request?', 'open'],
]

export function createBookingRow({ equipmentId, farmerId, start, end, status, rate, createdAgo = -1 }) {
  const days = daysInclusive(start, end)
  return Number(q.run(`INSERT INTO bookings(equipment_id,farmer_id,start_date,end_date,days,rate,estimate,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    equipmentId, farmerId, start, end, days, rate, rate * days, status, iso(createdAgo)).lastInsertRowid)
}

export function seedAdminFromEnv() {
  const a = config.admin
  if (!a.email || !a.password) return false
  if (q.get("SELECT 1 AS x FROM users WHERE role = 'Admin'")) return false
  const t = findTown('Pretoria')
  q.run(`INSERT INTO users(name,email,pass_hash,role,location,province,lat,lng,radius,phone,share_contact,status,verified,email_verified,since,created_at)
    VALUES(?,?,?,?,?,?,?,?,50,'',0,'active',1,1,?,?)`, a.name, a.email, hashPassword(a.password), 'Admin', t.label, t.province, t.lat, t.lng, new Date().getFullYear(), new Date().toISOString())
  return true
}

export function seedDemo() {
  const pass = hashPassword(DEMO_PASSWORD)
  const today = todayStr()
  const uid = {}
  USERS.forEach(([key, name, role, town, since, verified], i) => {
    const t = findTown(town)
    const op = OPS[key]
    const profile = op ? JSON.stringify({ years: op[0], certs: op[1], skills: op[2], dayRate: op[3], available: !!op[4], bio: op[5], rating: op[6] }) : null
    uid[key] = Number(q.run(`INSERT INTO users(name,email,pass_hash,role,location,province,lat,lng,radius,phone,share_contact,status,operator_profile,verified,email_verified,consent_at,consent_version,since,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,'active',?,?,1,?,?,?,?)`,
      name, `${key}@agrishare.demo`, pass, role, t.label, t.province, t.lat, t.lng, ['kagiso', 'botha', 'riaan'].includes(key) || i % 4 === 0 ? 100 : 50,
      `+27 82 555 ${String(100 + i).padStart(4, '0')}`, key === 'willem' ? 0 : 1, profile, verified, iso(-400), config.termsVersion, since, iso(-400)).lastInsertRowid)
  })
  const eid = {}, erate = {}
  EQUIP.forEach(([owner, name, type, rate, rating, reviews, operator], i) => {
    const o = USERS.find((u) => u[0] === owner)
    const t = findTown(o[3])
    const lat = t.lat + (((i * 37) % 100) - 50) / 1500
    const lng = t.lng + (((i * 53) % 100) - 50) / 1500
    const operatorId = operator && operator !== 'self' ? uid[operator] : null
    eid[name] = Number(q.run(`INSERT INTO equipment(owner_id,name,type,place,province,lat,lng,rate,base_rating,base_reviews,operator,operator_id,active,specs,description,images,views,created_at)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`,
      uid[owner], name, type, t.label, t.province, lat, lng, rate, rating, reviews, operator ? 1 : 0, operatorId,
      JSON.stringify(SPECS[type](i)), DESC[type], JSON.stringify([IMG[type][0], IMG[type][1], IMG.Tractor[0]]), 40 + ((i * 29) % 160), iso(-300)).lastInsertRowid)
    erate[name] = rate
    for (const [s, e] of BLOCKS[i % BLOCKS.length]) q.run('INSERT INTO equipment_blocks(equipment_id,start_date,end_date,note) VALUES(?,?,?,?)', eid[name], addDays(today, s), addDays(today, e), 'Owner using it')
  })
  const bid = []
  for (const [en, farmer, s, e, status] of BOOKINGS)
    bid.push(createBookingRow({ equipmentId: eid[en], farmerId: uid[farmer], start: addDays(today, s), end: addDays(today, e), status, rate: erate[en], createdAgo: Math.min(-1, s - 3) }))
  // one review on a completed booking (Nomsa's); another completed booking is left for the demo "leave a review"
  q.run('INSERT INTO reviews(booking_id,equipment_id,reviewer_id,rating,comment,created_at) VALUES(?,?,?,?,?,?)', bid[10], eid['Massey Ferguson 5710'], uid.nomsa, 5, 'Ran perfectly for two days. Owner was easy to deal with.', iso(-32))
  for (const [u, message, status] of TICKETS) q.run('INSERT INTO support(user_id,message,status,created_at) VALUES(?,?,?,?)', uid[u], message, status, iso(-3))
  q.run("INSERT INTO verification_requests(user_id,note,status,created_at) VALUES(?,?,'pending',?)", uid.hennie, 'Registered farm business: Nel Boerdery (Pty) Ltd. Please verify my account.', iso(-1))
  q.run("INSERT INTO role_change_requests(user_id,current_role,requested_role,reason,status,created_at) VALUES(?,?,'Equipment Owner',?,'pending',?)", uid.nomsa, 'Farmer', 'I recently acquired two planters and would like to list them for hire in Pretoria.', iso(-2))
  q.run('INSERT INTO reports(reporter_id,target_type,target_id,reason,detail,status,created_at) VALUES(?,?,?,?,?,?,?)', uid.johan, 'listing', eid['Landini Rex 100'], 'Photos look wrong', 'The photos do not look like a Landini.', 'open', iso(-1))
  const note = (u, t, b, ago, read) => q.run('INSERT INTO notifications(user_id,title,body,time,read) VALUES(?,?,?,?,?)', uid[u], t, b, iso(ago), read)
  note('thabo', 'Booking confirmed', 'John Deere 5075E is approved. Contact the owner to arrange payment and collection.', -6, 0)
  note('pieter', 'New booking request', 'Johan van Wyk wants Gaspardo 8-Row Planter.', -1, 0)
  for (const f of ['thabo', 'johan', 'nomsa']) q.run('INSERT INTO favorites(user_id,equipment_id) VALUES(?,?)', uid[f], eid['John Deere 5075E'])
}
