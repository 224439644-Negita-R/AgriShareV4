// Consistent copy of the database: `npm run backup`. Schedule it (cron / Render cron job) and copy the files off the server.
import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.mjs'
import { db } from './db.mjs'

const dir = path.join(config.dataDir, 'backups')
fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
const name = `agrishare-${new Date().toISOString().replace(/[:.]/g, '-')}.db`
db.exec(`VACUUM INTO '${path.join(dir, name).replace(/'/g, "''")}'`)
const keep = Number(process.env.BACKUP_KEEP) || 14
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.db')).sort()
for (const f of files.slice(0, Math.max(0, files.length - keep))) fs.rmSync(path.join(dir, f))
console.log(`Backup written: ${path.join(dir, name)} (keeping the newest ${keep}). Uploaded photos live in ${path.join(config.dataDir, 'uploads')}: back that folder up too.`)
