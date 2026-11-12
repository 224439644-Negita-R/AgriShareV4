# Security overview and pre-launch checklist

## Built in
- Passwords: scrypt with random salt, 10+ characters with a letter and a number, no name/email inside. Unknown emails cost the same time as real ones.
- Sessions: random 256-bit tokens stored only as SHA-256 hashes, 30-day limit, httpOnly + SameSite=Strict + Secure cookie (`__Host-` prefix in production). The web app's JavaScript never sees the token. The phone app keeps its token in secure storage.
- CSRF: cookie requests that change data must carry `X-Requested-With: AgriShare`; cross-site origins are refused.
- Rate limits: login (per account+IP and per IP), sign-up, password reset, verification, uploads, support, reports, bookings; global per-IP limit.
- Admin: two-factor (TOTP + recovery codes) forced in production; audit log of every admin action and security event; cannot remove the last admin or edit own role.
- Data minimisation: public listings show an approximate location (~3 km); exact position only to the owner, admins and a farmer with a confirmed booking. Phone/email shown only if the person opts in.
- Uploads: real file type checked from the bytes, metadata (EXIF GPS) stripped, size and pixel limits; ID documents stored outside the public folder, admin-only, deleted after the decision.
- Headers: CSP (no inline scripts), HSTS, nosniff, frame-deny, referrer and permissions policy. Strict CORS allow-list (plus the phone app's origins).
- Privacy (POPIA): consent recorded at sign-up, data export, in-app account deletion (anonymises, keeps financial records), blocking and reporting.
- No payment processing: AgriShare never handles money or card/bank details, which removes that whole category of risk. Terms tell users to agree payment directly and in writing.
- Logs contain no passwords, tokens, bodies, query strings or emails. Optional webhook for server errors.
- Production refuses to start without a strong secret, https URL, real email provider and with demo data off.

## Before you go live
- [ ] Hosting has HTTPS and a persistent disk; `APP_URL` is your https address; `TRUST_PROXY` matches your proxy count.
- [ ] Set a long random `SECRET_KEY` (never reuse across environments). Rotating it invalidates 2FA secrets, so re-enrol admins.
- [ ] Admin password changed, 2FA enabled, recovery codes stored offline.
- [ ] Email domain verified (SPF/DKIM) so verification and reset emails arrive.
- [ ] Daily `npm run backup` + off-server copy of `data/backups` and `data/uploads`; do a test restore.
- [ ] Terms/Privacy reviewed by an attorney; Information Officer registered; support email monitored.
- [ ] `npm audit` clean on the app dependencies (`app/`); keep Node updated.
- [ ] Third-party penetration test; fix findings.
- [ ] Uptime monitoring on `/healthz` and an error webhook configured.
