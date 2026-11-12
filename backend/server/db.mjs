import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.mjs'

let DatabaseSync
try {
  ;({ DatabaseSync } = await import('node:sqlite'))
} catch {
  throw new Error('AgriShare needs Node.js 22.13 or newer (it uses the built-in SQLite). Please update Node from nodejs.org.')
}

export const UPLOADS = path.join(config.dataDir, 'uploads') // public equipment photos
export const PRIVATE = path.join(config.dataDir, 'private') // ID documents: only served to admins
fs.mkdirSync(UPLOADS, { recursive: true })
fs.mkdirSync(PRIVATE, { recursive: true, mode: 0o700 })

export const db = new DatabaseSync(path.join(config.dataDir, 'agrishare.db'))
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
db.exec(`CREATE TABLE IF NOT EXISTS role_change_requests(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_role TEXT NOT NULL, requested_role TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT NOT NULL DEFAULT '', reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL, decided_at TEXT);`)
export const q = {
  all: (sql, ...a) => db.prepare(sql).all(...a),
  get: (sql, ...a) => db.prepare(sql).get(...a),
  run: (sql, ...a) => db.prepare(sql).run(...a),
}
export const tx = (fn) => {
  db.exec('BEGIN IMMEDIATE')
  try {
    const r = fn()
    db.exec('COMMIT')
    return r
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

export const SCHEMA_VERSION = 6
const SCHEMA = `
CREATE TABLE users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, pass_hash TEXT NOT NULL,
  role TEXT NOT NULL, location TEXT NOT NULL, province TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  radius INTEGER NOT NULL DEFAULT 50, phone TEXT NOT NULL DEFAULT '', share_contact INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active', operator_profile TEXT, verified INTEGER NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0, totp_secret TEXT, totp_enabled INTEGER NOT NULL DEFAULT 0,
  consent_at TEXT, consent_version TEXT, since INTEGER NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE sessions(token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL, last_seen TEXT NOT NULL, user_agent TEXT NOT NULL DEFAULT '');
CREATE TABLE one_time_tokens(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, expires_at TEXT NOT NULL, used_at TEXT);
CREATE TABLE recovery_codes(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, code_hash TEXT NOT NULL, used_at TEXT);
CREATE TABLE equipment(
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, type TEXT NOT NULL, place TEXT NOT NULL, province TEXT NOT NULL, lat REAL NOT NULL, lng REAL NOT NULL,
  rate INTEGER NOT NULL, base_rating REAL, base_reviews INTEGER NOT NULL DEFAULT 0,
  operator INTEGER NOT NULL DEFAULT 0, operator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  active INTEGER NOT NULL DEFAULT 1, specs TEXT NOT NULL DEFAULT '[]', description TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]', views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
CREATE TABLE equipment_blocks(id INTEGER PRIMARY KEY, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
CREATE TABLE bookings(
  id INTEGER PRIMARY KEY, equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
  farmer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL, end_date TEXT NOT NULL, days INTEGER NOT NULL, rate INTEGER NOT NULL, estimate INTEGER NOT NULL,
  status TEXT NOT NULL, cancelled_by TEXT, created_at TEXT NOT NULL, decided_at TEXT);
CREATE TABLE reviews(id INTEGER PRIMARY KEY, booking_id INTEGER NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, reviewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL, comment TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE TABLE favorites(user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL REFERENCES equipment(id) ON DELETE CASCADE, PRIMARY KEY(user_id, equipment_id));
CREATE TABLE notifications(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, body TEXT NOT NULL, time TEXT NOT NULL, read INTEGER NOT NULL DEFAULT 0);
CREATE TABLE devices(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE, platform TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE support(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE TABLE verification_requests(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note TEXT NOT NULL DEFAULT '', doc_file TEXT, status TEXT NOT NULL DEFAULT 'pending', reason TEXT NOT NULL DEFAULT '',
  reviewer_id INTEGER, created_at TEXT NOT NULL, decided_at TEXT);
CREATE TABLE role_change_requests(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_role TEXT NOT NULL, requested_role TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending',
  review_note TEXT NOT NULL DEFAULT '', reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL, decided_at TEXT);
CREATE TABLE reports(id INTEGER PRIMARY KEY, reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL);
CREATE TABLE blocks(blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, PRIMARY KEY(blocker_id, blocked_id));
CREATE TABLE audit_log(id INTEGER PRIMARY KEY, actor_id INTEGER, action TEXT NOT NULL, target TEXT NOT NULL DEFAULT '',
  detail TEXT NOT NULL DEFAULT '', ip TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL);
CREATE INDEX idx_eq_owner ON equipment(owner_id);
CREATE INDEX idx_bk_eq ON bookings(equipment_id, status);
CREATE INDEX idx_bk_farmer ON bookings(farmer_id);
CREATE INDEX idx_blocks_eq ON equipment_blocks(equipment_id);
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_audit_time ON audit_log(created_at);
CREATE INDEX idx_role_req_user ON role_change_requests(user_id, status);
`
export const TABLES = ['audit_log', 'blocks', 'reports', 'role_change_requests', 'verification_requests', 'support', 'devices', 'notifications', 'favorites', 'reviews', 'bookings', 'equipment_blocks', 'equipment', 'recovery_codes', 'one_time_tokens', 'sessions', 'users']

export function createSchema() {
  for (const t of [...TABLES]) db.exec(`DROP TABLE IF EXISTS ${t}`)
  db.exec(SCHEMA)
  db.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`)
}
export function wipeUploads() {
  for (const dir of [UPLOADS, PRIVATE]) for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true })
}

/** Opens the database. Development rebuilds an out-of-date database (demo data only). Production never deletes data. */
export function ensureSchema() {
  const version = q.get('PRAGMA user_version').user_version
  const hasTables = q.get("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name='users'").n > 0
  if (version === SCHEMA_VERSION && hasTables) return 'ready'
  if (config.prod && hasTables) throw new Error(`Database schema is version ${version}, this build needs ${SCHEMA_VERSION}. Back up and migrate before starting.`)
  createSchema()
  wipeUploads()
  return 'created'
}
