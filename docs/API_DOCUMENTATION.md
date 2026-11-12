# AgriShare API Documentation

Base URL: `https://<your-backend>.onrender.com/api` (local: `http://localhost:3001/api`). JSON over HTTPS. **75 endpoints.**

## Conventions
| Topic | Detail |
|---|---|
| Auth | `POST /auth/login` returns `{ "token": "..." }`. Send `Authorization: Bearer <token>` on every protected call. |
| Client header | Mobile clients send `X-Client: native` (token auth; no cookies/CSRF). Browser clients use an HttpOnly cookie and must send `X-Requested-With: AgriShare`. |
| Content type | `Content-Type: application/json` (max body 100 KB; image-upload endpoints allow up to 14 MB). |
| Errors | `{ "error": "Human readable message", "code"?: "..." }` with the status below. |
| Dates | `YYYY-MM-DD`. Money: whole South African rand. |

### Status codes
| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Validation failed (message says what to fix) |
| 401 | Missing/invalid/expired token (the app signs the user out) |
| 403 | Authenticated but role not allowed, blocked user, or CSRF check failed |
| 404 | Resource not found (or not yours) |
| 409 | Conflict, e.g. dates already booked / duplicate request |
| 429 | Rate limit hit (see table; `Retry-After` header) |

### Roles
`Farmer` hires equipment - `Equipment Owner` lists equipment and approves requests - `Operator` offers driving/operating skills - `Admin` moderates the platform.

### Booking life-cycle
`Pending` -> (owner approves) `Confirmed` -> (end date passes) `Completed` -> farmer may review.
Other end states: `Declined`, `Cancelled`, `Expired` (pending but start date passed).

## Example: login then browse
```http
POST /api/auth/login
X-Client: native
{ "email": "thabo@agrishare.demo", "password": "demo1234" }
-> 200 { "token": "wgzIal4c...", "user": { "id": 2, "name": "Thabo Mokoena", "role": "Farmer", "location": "Stellenbosch, Western Cape", ... } }

GET /api/equipment?type=Tractor&maxKm=100
Authorization: Bearer wgzIal4c...
-> 200 [ { "id": 7, "name": "...", "type": "Tractor", "rate": 1200, "km": 12, "owner": {...}, ... } ]
```
```http
POST /api/bookings                       (Farmer)
{ "equipmentId": 7, "startDate": "2026-11-23", "endDate": "2026-11-25" }
-> 200 { "id": 41, "status": "Pending", "days": 3, "estimate": 3600, ... }
-> 409 { "error": "Those dates are not available. Pick other dates." }
```


## Authentication & security

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `POST /auth/register` | Public | Create an account (Farmer, Equipment Owner or Operator) | `name, email, password (min 10, letter + number), role, acceptTerms:true`, optional `phone`, `location`/`lat`/`lng` | 10/hour per IP |
| `POST /auth/login` | Public | Log in. Returns `{token, user}`, or `{needs2fa:true}` when a 2FA code is required | `email, password`, optional `code` |  |
| `POST /auth/logout` | Public | End the current session |  |  |
| `POST /auth/logout-all` | Any logged-in user | End every session of this user |  |  |
| `POST /auth/verify` | Public | Confirm email address using the emailed token | `token` | 20/hour per IP |
| `POST /auth/resend-verification` | Any logged-in user | Re-send the verification email |  | 3/hour per user |
| `POST /auth/forgot` | Public | Request a password-reset email (always answers ok) | `email` | 8/hour per IP |
| `POST /auth/reset` | Public | Set a new password using the emailed token | `token, password` | 10/hour per IP |
| `POST /auth/change-password` | Any logged-in user | Change password while logged in | `current, password` | 10/hour per user |
| `POST /auth/2fa/setup` | Any logged-in user | Start authenticator-app 2FA; returns secret + otpauth URI |  | 10/hour per user |
| `POST /auth/2fa/enable` | Any logged-in user | Confirm 2FA with a code; returns one-time recovery codes | `code` | 10/hour per user |
| `POST /auth/2fa/disable` | Any logged-in user | Turn 2FA off | `password, code` | 10/hour per user |

## Account & profile

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /profile` | Any logged-in user | Current user profile |  |  |
| `PUT /profile` | Any logged-in user | Update name, phone, location, search radius, contact-sharing | any of `name, phone, shareContact, radius (5-100 km), location/lat/lng` |  |
| `GET /account/export` | Any logged-in user | Download all personal data (POPIA/GDPR style export) |  | 5/hour per user |
| `DELETE /account` | Any logged-in user | Delete the account and its data | `password` | 5/hour per user |
| `POST /devices` | Any logged-in user | Register a push-notification token | `token, platform: ios|android` |  |
| `DELETE /devices` | Any logged-in user | Remove a push token | `token` |  |
| `GET /notifications` | Any logged-in user | Notifications + unread count |  |  |
| `POST /notifications/read` | Any logged-in user | Mark all notifications read |  |  |
| `POST /support` | Any logged-in user | Open a support ticket | `message` | 5/hour per user |
| `GET /blocks` | Any logged-in user | Users I have blocked |  |  |
| `POST /blocks/:id` | Any logged-in user | Block / unblock a user (toggle) |  |  |
| `POST /reports` | Any logged-in user | Report a listing or user | `targetType: listing|user, targetId, reason, detail?` | 10/hour per user |
| `POST /verification` | Equipment Owner, Operator | Owner/Operator submits ID documents for the verified badge | `note, document (base64 image/pdf)` | 5/hour per user |
| `GET /verification/mine` | Equipment Owner, Operator | My verification status |  |  |
| `GET /account-type/request` | Any logged-in user | My pending role-change request |  |  |
| `POST /account-type/request` | Any logged-in user | Ask admin to change my account type | `requestedRole, reason?` | 10/hour per user |
| `POST /account-type/request/cancel` | Any logged-in user | Withdraw the request |  |  |

## Geo / location

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /config` | Public | Public app config (terms version, feature flags) |  |  |
| `GET /geo/provinces` | Public | The 9 provinces |  |  |
| `GET /geo/towns` | Public | Town search / autocomplete | `q, limit` | 120/1 min per IP |
| `GET /geo/popular` | Public | Popular towns | `province?` |  |
| `GET /geo/reverse` | Public | GPS point to nearest town | `lat, lng` | 60/1 min per IP |

## Equipment

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /categories` | Any logged-in user | Equipment types with live counts |  |  |
| `GET /equipment` | Any logged-in user | Browse/search equipment near a point, sorted by distance | `type, q, province, operator=true, saved=true, lat, lng, location, maxKm, all=true, sort=price-asc|price-desc, limit` |  |
| `GET /equipment/:id` | Any logged-in user | Equipment details incl. availability and owner |  |  |
| `POST /equipment` | Equipment Owner | List new equipment | `name (3-80), type, rate (R50-R200,000/day), operator?, operatorId?, description?, images[] (base64), location?` | 20/hour per user |
| `PATCH /equipment/:id` | Equipment Owner | Update daily rate or pause/resume a listing (own only) | `rate?, active?` |  |
| `DELETE /equipment/:id` | Equipment Owner | Delete (or hide if it has booking history) |  |  |
| `POST /equipment/:id/blocks` | Equipment Owner | Block dates the equipment is unavailable | `start, end, note?` | 60/hour per user |
| `DELETE /equipment/:id/blocks/:blockId` | Equipment Owner | Remove a blocked period |  |  |
| `POST /equipment/:id/favorite` | Farmer | Save / unsave equipment (toggle) |  |  |

## Bookings (Farmer)

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /bookings` | Farmer | My bookings (Farmer) |  |  |
| `POST /bookings` | Farmer | Request a booking. Max 30 days, up to 1 year ahead, no overlaps | `equipmentId, startDate, endDate` | 30/hour per user |
| `POST /bookings/:id/cancel` | Farmer | Cancel a Pending/Confirmed booking |  |  |
| `POST /bookings/:id/review` | Farmer | Rate a Completed booking | `rating 1-5, comment` | 20/hour per user |

## Equipment owner

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /owner/dashboard` | Equipment Owner | Owner stats, listings and incoming requests |  |  |
| `POST /owner/requests/:id/approve` | Equipment Owner | Confirm a request |  |  |
| `POST /owner/requests/:id/decline` | Equipment Owner | Decline a request |  |  |
| `POST /owner/requests/:id/cancel` | Equipment Owner | Cancel a confirmed booking |  |  |
| `POST /owner/simulate-request` | Equipment Owner | Demo helper: creates a sample incoming request |  |  |

## Operators

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /operators` | Farmer, Equipment Owner, Admin | Operator directory | `province, available=true, maxKm, all=true` |  |
| `GET /operator/profile` | Operator | My operator profile |  |  |
| `PUT /operator/profile` | Operator | Update operator profile | `years, certs, skills[], dayRate, available, bio` |  |

## Admin

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /admin/overview` | Admin | Platform statistics |  |  |
| `GET /admin/users` | Admin | List/search users | `q, role` |  |
| `PATCH /admin/users/:id` | Admin | Change role, suspend/activate, verify | `role?, status?, verified?` |  |
| `DELETE /admin/users/:id` | Admin | Delete a user |  |  |
| `GET /admin/equipment` | Admin | All listings | `q, province` |  |
| `PATCH /admin/equipment/:id` | Admin | Hide/show a listing | `active` |  |
| `DELETE /admin/equipment/:id` | Admin | Remove a listing |  |  |
| `GET /admin/bookings` | Admin | All bookings |  |  |
| `GET /admin/verifications` | Admin | Pending verification requests |  |  |
| `GET /admin/verifications/:id/document` | Admin | View the uploaded document |  |  |
| `POST /admin/verifications/:id/decide` | Admin | Approve / reject | `approve, reason?` |  |
| `GET /admin/role-requests` | Admin | Pending account-type requests |  |  |
| `POST /admin/role-requests/:id/decide` | Admin | Approve / reject | `approve, note?` |  |
| `GET /admin/reports` | Admin | User reports |  |  |
| `PATCH /admin/reports/:id` | Admin | Update report status | `status` |  |
| `GET /admin/tickets` | Admin | Support tickets |  |  |
| `PATCH /admin/tickets/:id` | Admin | Update ticket status | `status` |  |
| `GET /admin/audit` | Admin | Audit log of sensitive actions |  |  |
| `POST /reset` | Admin | Rebuild demo data (demo environments only; Admin) |  |  |

## System

| Method & path | Access | What it does | Input | Rate limit |
|---|---|---|---|---|
| `GET /health` | Public | Liveness + DB check (public) |  |  |

## Not in scope
There are **no payment endpoints** - hire terms and payment are agreed directly between farmer and owner. Contact numbers are only shown when the owner enabled `shareContact`.

## Testing
`docs/postman/AgriShare.postman_collection.json` runs 52 requests (happy paths, role guards, validation and conflict cases) against any server with demo data. With Newman: `newman run AgriShare.postman_collection.json -e AgriShare.local.postman_environment.json`. The backend also ships 98 automated checks: `cd backend && npm test`.
