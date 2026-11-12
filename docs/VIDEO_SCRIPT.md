# AgriShare - 4-minute system presentation (record with audio)

Tools: screen-record the phone (or Android emulator) + a slide for architecture; record narration in OBS, Loom or the phone's screen recorder. Target 4:00 (limit 3-5 min).

| Time | Show | Say |
|---|---|---|
| 0:00-0:25 | Title slide, logo | "AgriShare helps South African farmers hire tractors and harvesters from nearby owners, with an operator if needed. This is MVP 1 built with React Native Expo, Node.js and TypeScript." |
| 0:25-0:55 | Architecture diagram (`SYSTEM_DOCUMENTATION.md` section 3) | "The Expo app talks to a Node REST API over HTTPS. The API uses SQLite on a persistent disk and is deployed on Render. Roles: Farmer, Owner, Operator, Admin." |
| 0:55-1:50 | Phone: log in as Thabo, browse, filter Tractor, change location (GPS/town), open details, request dates | "A farmer sees equipment nearest first, filters by type, sets their location, and requests dates. The server rejects clashes and past dates." |
| 1:50-2:40 | Switch to Pieter: dashboard, approve; add equipment with photo; pause/resume it | "The owner gets the request, approves it, and manages listings." Then back to Thabo: booking Confirmed, then cancel. |
| 2:40-3:05 | Operators tab (list, availability, day rate) | "Operators publish skills and availability; farmers find them by distance." |
| 3:05-3:30 | Admin tab: overview, users, role requests | "Admins manage users and approve account-type requests; the API also has moderation, reports and an audit log." |
| 3:30-3:50 | Postman runner: 52/52 green; terminal `npm test` 98 passed | "Quality: 98 automated backend checks and a 52-request Postman suite." |
| 3:50-4:00 | Slide: APK link + repo + next steps | "Install the public APK from the link. Next: reviews, reporting, 2FA and the remaining admin screens, then push notifications. Thank you." |

Checklist: backend awake before recording; demo accounts ready; phone in Do-Not-Disturb; mic test; export MP4 under the portal's size limit.
