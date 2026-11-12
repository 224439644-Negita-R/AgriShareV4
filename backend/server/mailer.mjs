import { config } from './config.mjs'

export const sentMail = [] // last few emails (only used by the console driver, for tests and local development)

export async function sendMail({ to, subject, text }) {
  if (config.mail.provider === 'resend') {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.mail.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mail.from, to: [to], subject, text }),
    })
    if (!r.ok) throw new Error(`Email provider rejected the message (${r.status})`)
    return
  }
  // console driver (development): print the email instead of sending it
  sentMail.push({ to, subject, text, at: new Date().toISOString() })
  if (sentMail.length > 50) sentMail.shift()
  if (!config.prod) console.log(`[mail:console] to=${to} subject="${subject}"\n${text}\n`)
}

const wrap = (body) => `${body}\n\n— AgriShare\nIf you didn't expect this email you can ignore it.`
export const mails = {
  verify: (link) => ({ subject: 'Confirm your AgriShare email', text: wrap(`Welcome to AgriShare. Confirm your email address:\n${link}\n\nThis link works for 24 hours.`) }),
  reset: (link) => ({ subject: 'Reset your AgriShare password', text: wrap(`Someone asked to reset your password. If that was you, choose a new one here:\n${link}\n\nThis link works for 1 hour.`) }),
  notice: (title, body) => ({ subject: title, text: wrap(`${title}\n\n${body}\n\nOpen the AgriShare app to see more.`) }),
}
