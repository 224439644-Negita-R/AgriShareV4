# Build, publish and deploy

Order matters: **deploy the backend first** (the app needs its URL), then build the app.

## 1. Deploy the backend (Render)
1. Push this repo to GitHub.
2. Render > **New > Blueprint** > select the repo. It reads `backend/render.yaml` (Docker, 1 GB disk, health check `/healthz`).
3. When prompted for `APP_URL`, use `https://<service-name>.onrender.com`.
4. Wait for "Live", then check: `https://<service-name>.onrender.com/api/health` returns `{"ok":true}`.
5. Smoke test: import `docs/postman/` , select environment *Production*, set `baseUrl` to `https://<service-name>.onrender.com/api`, run the collection (expect 52/52).

The blueprint uses the **MVP settings** (`SEED_DEMO=true`, email verification and admin 2FA off) so assessors can log in with demo accounts immediately.
For real users: set `SEED_DEMO=false`, `MAIL_PROVIDER=resend` + `RESEND_API_KEY`, remove `ALLOW_INSECURE_DEFAULTS`/the two `REQUIRE_*` overrides, set `ADMIN_EMAIL`/`ADMIN_PASSWORD`.
Note: persistent disks need a paid Render plan. On a free plan the database resets on redeploy (fine for a demo, re-seeded automatically). Railway/Azure/AWS work with the same Dockerfile - mount a volume at `/data`.

## 2. Point the app at the backend
Edit `app/eas.json` and replace `https://REPLACE-WITH-YOUR-BACKEND.onrender.com/api` in all three profiles. It must end in `/api` and be `https://`.

## 3. One-time EAS setup (follows the Expo EAS guide)
```bash
cd app
npm install
npm install -g eas-cli
eas login
eas init                              # links the project to your Expo account (adds extra.eas.projectId to app.json)
npx expo install expo-dev-client      # only needed for the development build
npm run typecheck
```
First build: choose **Generate new Android Keystore** when asked.

## 4. Builds
| Goal | Command | Output |
|---|---|---|
| Development build (debug client, hot reload) | `eas build -p android --profile development` | APK with dev client; run `npx expo start --dev-client` |
| **Public APK - MVP 1** | `eas build -p android --profile preview` | installable `.apk` + shareable expo.dev link |
| Store release | `eas build -p all --profile production` | Android AAB + iOS IPA (iOS needs Apple Developer account, $99/yr) |

When the build finishes, open the link EAS prints, copy the **public build URL / download link** for the APK and put it in the README. Install on a device (allow "install unknown apps") or run `eas build:run -p android`.

## 5. Demo accounts
Password `demo1234` for: `thabo@agrishare.demo` (Farmer), `pieter@agrishare.demo` (Owner), `sipho@agrishare.demo` (Operator), `admin@agrishare.demo` (Admin).

## 6. Manual acceptance test (do on the installed APK)
1. Log in as Thabo: Browse shows nearby equipment; filter by Tractor; change location via GPS and via town search.
2. Open an item, pick dates, **Request booking**; it appears under Bookings as Pending.
3. Log in as Pieter (second device or after logging out): **Dashboard** shows the request; Approve it.
4. Back as Thabo: booking is Confirmed; cancel it.
5. As Pieter: add equipment (photo, rate); pause it, then resume it; delete it.
6. As Thabo: open Operators and confirm the directory lists operators near you (Sipho, Thandi...). As Sipho: log in and confirm the profile screen loads.
7. As Admin: Admin tab shows overview, users and role requests; as Thabo the Admin tab is absent. As Thabo request an account-type change; as Admin approve it.
8. Kill and reopen the app: still signed in. Log out: returns to login.

## 7. Troubleshooting
| Symptom | Fix |
|---|---|
| App shows network error | `EXPO_PUBLIC_API_URL` wrong or backend asleep (free Render plans cold-start ~30 s); open `/api/health` in a browser |
| Build fails on assets | Icons must be real PNGs (Git LFS pointer files break builds): `git lfs ls-files`, or keep the PNGs in `app/assets` committed as normal files |
| Cleartext HTTP blocked on release APK | Use an `https://` API URL |
| Login says email not verified | Backend running with strict production settings - use the blueprint's MVP flags |
