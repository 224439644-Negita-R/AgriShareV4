import { q } from './db.mjs'
import { sendMail, mails } from './mailer.mjs'
import { pushToUser } from './push.mjs'
import { reportError } from './core.mjs'

/** In-app notification, plus a push to the user's phones and (optionally) an email. Never throws. */
export function notify(userId, title, body, { email = false } = {}) {
  q.run('INSERT INTO notifications(user_id,title,body,time,read) VALUES(?,?,?,?,0)', userId, title, body, new Date().toISOString())
  pushToUser(userId, title, body).catch((e) => reportError(e, 'push'))
  if (email) {
    const u = q.get('SELECT email, email_verified FROM users WHERE id = ?', userId)
    if (u?.email_verified) sendMail({ to: u.email, ...mails.notice(title, body) }).catch((e) => reportError(e, 'mail'))
  }
}
