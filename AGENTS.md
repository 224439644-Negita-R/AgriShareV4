# AGENTS.md - guide for AI coding agents working on AgriShare

AgriShare is a mobile marketplace where South African farmers hire tractors, harvesters, planters and irrigation
equipment (optionally with an operator) from nearby owners. Roles: **Farmer**, **Equipment Owner**, **Operator**, **Admin**.

## Repo layout
```
AgriShare/
  app/        Expo (React Native) + TypeScript mobile app  -> talks to the API over HTTPS
  backend/    Node.js 22 REST API, built-in SQLite, zero runtime dependencies (ES modules, .mjs)
  docs/       System docs, API docs, Postman suite, project tracker, design brief, video script
```

## Commands
| Where | Command | Purpose |
|---|---|---|
| backend | `npm start` | run API on :3001 (demo data seeded in development) |
| backend | `npm test` | 98 integration checks on a throw-away DB; must stay green |
| app | `npm install && npx expo start` | run in Expo Go / emulator |
| app | `npm run typecheck` | `tsc --noEmit`; must stay clean |
| app | `eas build -p android --profile preview` | installable APK |

Requires Node >= 22.13 (uses `node:sqlite`).

## Architecture rules
- **Backend**: one file per area in `backend/server/routes/` (auth, account, geo, equipment, bookings, operators, admin).
  Register endpoints with `route(method, path, handler, opts)` from `core.mjs`; `opts` = `{auth, roles, limit, verified}`.
  Throw `bad()`, `forbidden()`, `notFound()` or `HttpError` - never write responses by hand.
  SQL is always parameterised through `q.get/all/run`. Schema lives in `db.mjs` (bump `SCHEMA_VERSION` when it changes).
- **App**: `app/src/api.ts` is the only place that calls `fetch`. Screens are in `app/src/components/`, shared types in
  `types.ts`, colours in `theme.ts`, platform differences (token storage, haptics, location, API base URL) in `platform.ts`.
- The native app authenticates with `Authorization: Bearer <token>` (stored in `expo-secure-store`) and sends `X-Client: native`.
- The API base URL comes from `EXPO_PUBLIC_API_URL` (set per profile in `app/eas.json`) and must end in `/api`.

## Conventions
- TypeScript strict in `app/`; no `any` unless unavoidable. Backend is plain ESM JavaScript.
- No payment processing exists by design (hire is arranged between parties). Do not add payment endpoints.
- Validate on the server; the app's checks are only for UX. Every new endpoint needs: role guard, input validation,
  a rate limit if it writes, a test in `backend/tests/api.test.mjs`, and a row in `docs/API_DOCUMENTATION.md` + the Postman suite.
- Dates are ISO `YYYY-MM-DD`, South African time (UTC+2). Money is whole rand (ZAR).

## Never do
- Commit `.env`, `backend/data/`, `*.db`, `.secret`, keystores or API keys.
- Return password hashes or other users' contact details (respect `share_phone`).
- Weaken production safety checks in `backend/server/config.mjs`.
- Run `POST /reset` anywhere but a demo environment (it wipes the database).

## Demo accounts (when SEED_DEMO=true; password `demo1234`)
`thabo@agrishare.demo` Farmer - `pieter@agrishare.demo` Equipment Owner - `sipho@agrishare.demo` Operator - `admin@agrishare.demo` Admin
