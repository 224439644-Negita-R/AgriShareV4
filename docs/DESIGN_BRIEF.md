# AgriShare - UI/UX design brief (build this in Figma)

I cannot create or publish a Figma file from here, so this is the specification for the Figma file, derived from the screens that exist in the app (`app/src/components`). Create one Figma file "AgriShare - MVP 1" with the pages below, then paste the share link into the README.

## 1. Design tokens (from `app/src/theme.ts`)
| Token | Value | Use |
|---|---|---|
| bgDark | #0B0F19 | screen background |
| bgCard | #111827 / bgInput #172033 / bgSubtle #1E293B | cards, inputs |
| primary | #10B981 (hover #059669) | buttons, active tab |
| accent | #F59E0B | ratings, highlights |
| danger | #EF4444 | cancel / destructive |
| info | #3B82F6 | informational badges |
| text | #F9FAFB primary, #9CA3AF secondary, #6B7280 muted | |
| border | #1F2937 / #374151 | |
Type: system font (SF / Roboto). Sizes 12 / 14 / 16 / 20 / 28. Radius 12-16. Spacing 4-pt grid. Minimum tap target 44 px.

Legend: **[built]** = screen exists in the app today; **[planned]** = backend endpoint exists, screen still to build - design it so the Figma file also guides development.

## 2. Figma pages and frames (390 x 844, iPhone 14 / Pixel size)
1. **Cover + flows** - user-flow diagram for the 4 roles.
2. **Foundations** - tokens above as Figma variables; button, input, chip, badge, card, modal, tab-bar components.
3. **Onboarding & auth** - Login [built], Register with role picker [built], 2FA code entry [built], Forgot password [planned]. (`AuthModal`)
4. **Farmer** - Browse (search, category chips, equipment cards with distance/price/rating) - Location picker (GPS, town search, radius) - Equipment details (gallery, specs, owner, availability calendar, Request) - Bookings (Pending / Confirmed / Completed, cancel) [built]; leave a review [planned].
5. **Owner** - Dashboard (stats, incoming requests with Approve/Decline) [built] - Add equipment (photos, rate, operator) [built] - Pause/delete listing [built] - Block dates [planned].
6. **Operator** - Operators directory [built] - Operator profile editor [planned].
7. **Profile & settings** - edit details, change password, account-type change request [built]; 2FA set-up, verification upload, export/delete data, support, notifications, report/block [planned].
8. **Admin** - Overview, Users, Role requests [built]; Listings, Bookings, Reports, Tickets, Verifications, Audit [planned].
9. **States** - empty lists, loading skeletons, offline/error, 401 sign-out, booking conflict (409).
10. **Prototype** - connect Browse > Details > Request > Bookings and Owner Approve flow.

## 3. UX principles
Big thumb-friendly controls for use outdoors; plain English, short labels; show distance and price first; always show booking status with colour **and** text; works on low-end Android and low data (small images).

## 4. Hand-off
Name Figma layers to match components (`EquipmentCard`, `BookingsView`...). Export the Figma link into README and `docs/`.
