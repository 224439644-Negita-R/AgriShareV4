// Push notifications to phones (Android/iOS apps built later with Capacitor register a device token via POST /api/devices).
// "console" just logs. "fcm" sends through Firebase Cloud Messaging (HTTP v1). The FCM driver has not been tested against a live project.
import crypto from 'node:crypto'
import { config } from './config.mjs'
import { q } from './db.mjs'

let cached = { token: '', exp: 0 }
async function fcmAccessToken() {
  if (cached.exp > Date.now() + 60_000) return cached.token
  const { fcmClientEmail: iss, fcmPrivateKey: key } = config.push
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const head = b64({ alg: 'RS256', typ: 'JWT' })
  const claim = b64({ iss, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claim}`).sign(key, 'base64url')
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
  })
  if (!r.ok) throw new Error('FCM auth failed')
  const j = await r.json()
  cached = { token: j.access_token, exp: Date.now() + j.expires_in * 1000 }
  return cached.token
}

export async function pushToUser(userId, title, body) {
  const devices = q.all('SELECT id, token FROM devices WHERE user_id = ?', userId)
  if (!devices.length) return
  if (config.push.provider !== 'fcm') {
    if (!config.prod) console.log(`[push:console] user=${userId} "${title}": ${body}`)
    return
  }
  const access = await fcmAccessToken()
  for (const d of devices) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${config.push.fcmProjectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: { token: d.token, notification: { title, body } } }),
    })
    if (r.status === 404 || r.status === 400) q.run('DELETE FROM devices WHERE id = ?', d.id) // token no longer valid
  }
}
