import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { UPLOADS, PRIVATE } from './db.mjs'
import { bad } from './core.mjs'
import { sanitizeImage } from './images.mjs'

const DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/
const decode = (d, maxBytes) => {
  const m = DATA_URL.exec(String(d))
  if (!m) throw bad('Photos must be JPG, PNG or WebP images')
  const buf = Buffer.from(m[1], 'base64')
  if (buf.length > maxBytes) throw bad(`Each photo must be under ${Math.round(maxBytes / 1024 / 1024)} MB`)
  return sanitizeImage(buf) // checks the real file type + strips location metadata
}

/** Public equipment photos: returns URLs like /api/uploads/ab12.jpg */
export function saveImages(list) {
  if (list === undefined) return []
  if (!Array.isArray(list) || list.length > 3) throw bad('You can add up to 3 photos')
  const saved = []
  try {
    for (const d of list) {
      const { buf, ext } = decode(d, 3 * 1024 * 1024)
      const name = crypto.randomBytes(8).toString('hex') + '.' + ext
      fs.writeFileSync(path.join(UPLOADS, name), buf)
      saved.push('/api/uploads/' + name)
    }
  } catch (e) {
    removeImages(saved)
    throw e
  }
  return saved
}
export function removeImages(urls) {
  for (const u of urls || []) {
    const m = /^\/api\/uploads\/([a-f0-9]{16}\.(?:jpg|png|webp))$/.exec(u)
    if (m) fs.rmSync(path.join(UPLOADS, m[1]), { force: true })
  }
}
/** ID documents: stored outside the public folder, only readable by admins. Returns the file name. */
export function savePrivateImage(dataUrl) {
  const { buf, ext } = decode(dataUrl, 5 * 1024 * 1024)
  const name = crypto.randomBytes(12).toString('hex') + '.' + ext
  fs.writeFileSync(path.join(PRIVATE, name), buf, { mode: 0o600 })
  return name
}
export const readPrivate = (name) => (/^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name || '') && fs.existsSync(path.join(PRIVATE, name)) ? fs.readFileSync(path.join(PRIVATE, name)) : null)
export const deletePrivate = (name) => name && /^[a-f0-9]{24}\.(jpg|png|webp)$/.test(name) && fs.rmSync(path.join(PRIVATE, name), { force: true })
