# AgriShare

Mobile marketplace for hiring farm equipment and operators in South Africa.
React Native (Expo) + TypeScript app, Node.js REST API. MVP 1.

```
app/       Expo mobile app          backend/   Node.js API (SQLite)
docs/      documentation & deliverables
```

## Run it locally (5 minutes)
```bash
# 1. API  (Node >= 22.13)
cd backend && npm start            # http://localhost:3001, demo data included

# 2. App
cd app && npm install && npx expo start
#   Expo Go on a phone on the same Wi-Fi: scan the QR code (API address is auto-detected)
#   Android emulator: press "a"  (uses http://10.0.2.2:3001/api)
```
Log in with `thabo@agrishare.demo` / `demo1234` (Farmer). More accounts: see `AGENTS.md`.

## Deliverables map
| Requirement | Where |
|---|---|
| Repo with `app` and `backend` | this repo |
| Figma UI/UX design | `docs/DESIGN_BRIEF.md` (screen inventory + design tokens to build the Figma file) |
| Agents.md | `AGENTS.md` |
| System documentation | `docs/SYSTEM_DOCUMENTATION.md` |
| API documentation | `docs/API_DOCUMENTATION.md` |
| Postman test cases | `docs/postman/` (52 requests, all passing) |
| Project tracker (PDF) | `docs/AgriShare_Project_Tracker.pdf` |
| Development build, APK, deployment | `docs/BUILD_AND_DEPLOY.md` |
| 3-5 minute presentation | `docs/VIDEO_SCRIPT.md` |

## Tests
`cd backend && npm test` (98 checks) - and import `docs/postman/` into Postman or run it with Newman.
