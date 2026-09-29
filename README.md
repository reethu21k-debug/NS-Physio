# NS Physio Clinic — Appointment Booking Platform

Public site + patient accounts + 5-step booking + offline / manual-UPI payment with screenshot proof + admin console.
React (Vite, TS, Tailwind) · Express (TS) · Supabase (Postgres, Auth, RLS) · Cloudinary · Nodemailer.

## Features
- Landing, Services, About, Contact (all clinic details/services/prices come from the database)
- Supabase Auth: register, login, logout, forgot/reset password
- Booking: service → date → time → review → payment → confirmation; 30-min slots (configurable), morning/evening windows, Asia/Kolkata
- Payments: **Pay at Clinic** or **UPI (QR + ID) with screenshot upload** (JPG/PNG/WebP, ≤5 MB, magic-byte checked, stored in Cloudinary); admin verify/reject (reason required); user can re-upload after rejection
- Admin: dashboard, appointments (search/filters/pagination), appointment detail with valid-only actions, payments queue, services CRUD (pricing types `fixed | starting_from | contact`, image, reorder, safe delete), time-slot blocking / full-day closure, users, settings (incl. UPI ID/QR, cancellation window)
- Emails (HTML): request received, confirmed, payment rejected, cancelled. SMTP failures are logged and never fail a booking
- Audit: `appointment_events` (per appointment) and `audit_logs` (payments, confirmations, cancellations, services, settings, slots)

## Structure
```
client/            React app (src/pages, src/components, src/lib)
server/            Express API (src/routes, src/lib, src/middleware, src/tests)
supabase/
  migrations/      0001 schema · 0002 RLS · 0003 booking RPC + block RPC · 0004 hardening (no client write path)
  seed.sql         default settings + 4 services (no fake users/appointments)
  verify/          script that runs the SQL against an in-process Postgres
```

## Data model
`profiles, services, appointments, payments, blocked_slots, clinic_settings, appointment_events, audit_logs`.
Appointment status: `pending, payment_submitted, payment_verified, confirmed, rejected, cancelled, completed`. Payment status: `pending, submitted, verified, rejected`.

## Setup

### 1. Supabase
1. Create a project. Copy **Project URL**, **anon key** (frontend) and **service_role key** (backend only).
2. Run the SQL in order in the SQL Editor (or `supabase db push` with the CLI): `migrations/0001_schema.sql`, `0002_rls.sql`, `0003_booking_rpc.sql`, `0004_hardening.sql`, then `seed.sql`.
3. Auth → URL Configuration: Site URL = your frontend URL; add `<frontend>/reset-password` to Redirect URLs.
4. Auth → Providers → Email: decide whether "Confirm email" is on (the app handles both).

### 2. First admin (no default password exists)
1. Register normally on the site (or create the user in Supabase → Authentication).
2. In the SQL Editor run:
   ```sql
   update public.profiles set role = 'admin' where email = 'owner@yourclinic.com';
   ```
   The SQL editor/service role is the only path that can change `role`; a trigger blocks it for every client session.

### 3. Cloudinary
Create an account → Dashboard → copy cloud name, API key, API secret into `server/.env`. Uploads go browser → API → Cloudinary (signed server-side), folders `ns-physio/payment-proofs|services|clinic`. Payment proofs are stored as Cloudinary **authenticated** assets: they have no public URL and are only shown through short-lived signed URLs the API issues to the owning user or an admin.

### 4. SMTP
Any provider (Gmail app password, Brevo, SES, Mailgun…). Set `SMTP_HOST/PORT/USER/PASSWORD/FROM`. Port 465 uses TLS; 587 uses STARTTLS. Without SMTP configured the API logs "skipped" and continues.

### 5. Environment
Copy `.env.example` values: `VITE_*` → `client/.env`; the rest → `server/.env` (`server/.env.example` and `client/.env.example` are provided).

### 6. Run locally
```bash
npm run install:all
npm run dev:server     # http://localhost:4000
npm run dev:client     # http://localhost:5173 (proxies /api)
npm test               # server unit tests
npm run typecheck      # server + client (tsc --noEmit)
```
Then sign in as the admin → **Admin → Settings**: set clinic phone/email/address, timings, UPI ID and upload the QR image.

### Logo & hero
**Action required:** the logo file is not in the repository. Place the clinic's logo at `client/public/logo.png` (used in navbar, footer, favicon; a text wordmark is shown if the file is absent). The hero uses an abstract SVG — replace `HeroArt` in `client/src/pages/public/Home.tsx` with a licensed physiotherapy photo if desired.

## Deployment
- **API**: `npm --prefix server run build && npm --prefix server start` on Render/Railway/Fly/VPS. Set `NODE_ENV=production`, `CLIENT_URL=https://your-frontend`, and all server env vars. Behind a proxy `trust proxy` is enabled in production.
- **Frontend**: `npm --prefix client run build` → deploy `client/dist` (Netlify/Vercel/Cloudflare Pages). Set `VITE_API_URL` to the API origin and add an SPA rewrite `/* → /index.html`.
- Only the anon key is shipped to the browser.

## Security notes
- **Price is never trusted**: the client sends `service_id`; `book_appointment()` reads the price from `services`. Booking schema is `.strict()` — extra fields like `amount`/`status`/`role` are rejected.
- **Double booking**: Postgres `EXCLUDE USING gist` on the appointment time range (live statuses only) + advisory lock per day; races end in `SLOT_TAKEN` → HTTP 409. Cancelled/rejected appointments free the slot.
- **Authorization**: API verifies the Supabase JWT, loads `role` from `profiles` (never from the token/metadata); admin routes use `requireAdmin`; users get 404 (not 403) for others' appointments (IDOR-safe). RLS gives users read-only access to their own rows and no direct write to appointments/payments; a trigger blocks role/email/active changes.
- **Uploads**: MIME + extension + magic-byte sniffing, 5 MB cap, random Cloudinary IDs (filename ignored), SVG/HTML/PDF rejected.
- Clients have **no direct database write path**: migration 0004 removes the admin write policies and revokes INSERT/UPDATE/DELETE from `anon`/`authenticated`, so every state change goes through the API's state machine and audit log.
- Payment proofs are private (Cloudinary `authenticated` type + signed URLs). Each account may hold at most 5 upcoming live appointments (slot-hoarding guard).
- Helmet, CORS allow-list, rate limits (incl. a tighter cap on upload routes), 50 KB JSON limit, central error handler (no stack traces in production).

## Known limitations / notes
- The clinic is modelled as **one practitioner**: no two live appointments can overlap in time. For multiple practitioners add a `practitioner_id` to the exclusion constraint.
- `rejected` (appointment) exists in the schema and state rules, but the admin UI has no "reject appointment" button — admins cancel instead.
- Refunds for cancelled paid appointments are manual.
- Emails are retried 3 times with back-off inside the request's background task; there is no persistent outbox, so a process restart mid-retry loses that email (failures are logged).
- No ESLint config is included (`lint` is not available); `typecheck` and unit tests are.
- Unpaid online bookings hold their slot until an admin cancels them (no automatic expiry).
- Offline appointments keep `payment_status = pending` after completion (cash is not tracked).
- Contact-pricing services can only be booked as Pay at Clinic; the appointment amount is `NULL` ("to be confirmed"), never 0.
