# Premium Rentals — Airport Transfer Booking App

A full-stack luxury airport pickup, drop-off and chauffeur booking platform built with **Next.js 15 (App Router, TypeScript)**, **Tailwind CSS v4**, **Framer Motion**, **Supabase**, **Stripe**, **Google Maps** and **AirLabs** flight tracking.

It runs with **zero API keys** in Demo Mode: bookings are stored in the browser (LocalStorage), payments are mocked and flight status is simulated. Prices are still calculated on the server.

## Features

| Area | What it does |
| --- | --- |
| `/` | Landing page with instant-quote widget, fleet carousel, flat-rate table, service highlights and FAQ |
| `/book` | 4-step booking: Trip Details → Vehicle & Extras → Contact & Flight → Review & Pay (Stripe or "Email me this quote") |
| `/track` | Booking lookup by reference + email/phone, live status timeline, driver details, flight status, pay-later and 24-hour cancellation |
| `/admin` | Passcode-protected dispatch dashboard: filters, search, assign driver/vehicle, change status, override final fare, CSV export, add drivers, edit flat rates |
| `/driver` | Mobile duty portal: assigned rides by day, En Route → Arrived → On Board → Completed, one-tap Google Maps navigation |

**Services:** To the Airport/Station, From the Airport/Station (flight tracked), Hourly (3-hour minimum), Point-to-Point. One-way or round trip. Extras: Meet & Greet (+$25), child seats (+$15 each).

**Pricing** (`lib/pricing.ts`, called only on the server):

1. Hourly: `max(hours, min_hours) × hourly_rate`
2. Airport transfer: flat rate from `flat_rates (airport_code, city_zone, vehicle_class_id)`, same in both directions
3. Unlisted address / point-to-point: `base_fare + miles × per_mile_rate`
4. Round trip ×2 (not hourly)
5. Extras added last

The Stripe PaymentIntent amount is always recomputed on the server (`/api/stripe/payment-intent`). The browser never sends a price.

**Cancellation policy** (`lib/policy.ts`): full refund at least 24 hours before pickup. 100% refund at any time if the airline cancels the flight. Inside 24 hours the ride can be cancelled but is non-refundable.

## Quick start (Demo Mode, no keys)

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000.

- Admin: http://localhost:3000/admin, passcode `admin123`
- Driver: http://localhost:3000/driver, passcode `driver123`, then pick a driver
- Sample booking for `/track`: `PR-DEMO01` with `avery@example.com`
- In Demo Mode, flight numbers ending in `0` (e.g. `AA2140`) simulate an airline cancellation
- "Reset demo data" in the top banner restores the sample bookings

## Test online with GitHub Codespaces (free)

GitHub Pages can't run this app (it only hosts static files, and the app needs its server for pricing and payments). Codespaces runs the full app in GitHub's cloud for free (60 hours/month on a 2-core machine for personal accounts).

1. Optional: add your test keys as Codespaces secrets at **GitHub → Settings → Codespaces → Secrets** (names as in `.env.example`) and give them access to this repository. Without them the app runs in Demo Mode.
2. On the repo page click **Code → Codespaces → Create codespace on main**. Dependencies install and the site starts automatically.
3. In the **Ports** tab, right-click port 3000 → **Port visibility → Public** to get a link you can open on any device or share with testers.

The link only works while the codespace is running; it stops after ~30 minutes of inactivity. Restart it from https://github.com/codespaces.

## Going live

Copy the env template and fill in what you have. Every integration is independent.

```bash
cp .env.example .env.local
```

| Variable | Enables |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Real database. **All three are required** to leave Demo Mode |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Real card payments and refunds |
| `GEOAPIFY_API_KEY` | **Free** address suggestions and driving distances (3,000 credits/day, no credit card). Requires the "Powered by Geoapify · © OpenStreetMap" attribution, which the app shows |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (+ optional `GOOGLE_MAPS_SERVER_KEY`) | Address autocomplete (Places API New) and driving distances (Routes API). Without it, distances use OpenStreetMap |
| `AIRLABS_API_KEY`, `CRON_SECRET` | Live flight status and the pickup-adjustment cron |
| `RESEND_API_KEY`, `FROM_EMAIL`, `DISPATCH_EMAIL` | Quote, confirmation, cancellation and flight-alert emails (otherwise logged to the console) |
| `ADMIN_PASSCODE`, `DRIVER_PASSCODE`, `SESSION_SECRET` | Sign-in for `/admin` and `/driver`. **Change these in production** |

> Don't run in production without Stripe: when Stripe is not configured, the checkout uses a mock "Pay (demo)" button.

### 1. Supabase

1. Create a project at https://supabase.com.
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql` and run it. It creates the tables, Row Level Security policies and seed data (4 vehicle classes, 208 flat rates, 3 sample drivers, 4 vehicles). It is safe to re-run.
3. From **Project Settings → API Keys**, copy into `.env.local`: the project URL (`https://<project-ref>.supabase.co`) → `NEXT_PUBLIC_SUPABASE_URL`, the **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and the **Secret key** (`sb_secret_…`) → `SUPABASE_SERVICE_ROLE_KEY`. Legacy anon/service_role keys also work.
4. When creating the project, keep **Enable Data API** and **Grant API access to new tables automatically** turned on.

The service-role key is only used on the server. The anon key can only read the price list.

### 2. Stripe

1. Copy your test keys from https://dashboard.stripe.com/test/apikeys.
2. Local webhooks: `stripe listen --forward-to localhost:3000/api/stripe/webhook` and put the printed `whsec_…` in `STRIPE_WEBHOOK_SECRET`. (Without the CLI, the app still confirms payments through `/api/stripe/confirm`.)
3. Production: add a webhook endpoint `https://YOUR-DOMAIN/api/stripe/webhook` for `payment_intent.succeeded` and `charge.refunded`.

Test card: `4242 4242 4242 4242`, any future date, any CVC.

### 3. Maps: Geoapify (free) or Google

**Free:** sign up at https://www.geoapify.com (no card), create a project at https://myprojects.geoapify.com, and set `GEOAPIFY_API_KEY`. The key stays on the server; the browser calls `/api/places/autocomplete`.

**Google (optional, needs billing):**

Enable **Places API (New)** and **Routes API** (Distance Matrix is now a legacy API). If your browser key is restricted to your domain (recommended), add an unrestricted-by-referrer, API-restricted `GOOGLE_MAPS_SERVER_KEY` for server-side distance lookups.

### 4. AirLabs flight tracking

Get a key at https://airlabs.co. Vercel Cron calls `GET /api/cron/flight-status` every 15 minutes (`vercel.json`). It checks `from_airport` bookings with a flight number picking up in the next 6 hours. If the arrival estimate moves by more than 10 minutes, it updates `adjusted_pickup_at` and `flight_status` and emails the driver and dispatch.

Vercel sends `Authorization: Bearer $CRON_SECRET` automatically. To trigger it manually:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/flight-status
```

> Vercel's Hobby plan runs cron jobs at most once a day. The 15-minute schedule needs a Pro plan, or an external scheduler (e.g. GitHub Actions or cron-job.org) calling the URL above.

## Push to GitHub

```bash
git init -b main
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR-USER/airport-transfer-app.git
git push -u origin main
```

`.env.local` is git-ignored. Never commit real keys.

## Deploy to Vercel

1. Go to https://vercel.com/new and import the GitHub repository (framework is detected as Next.js).
2. Add the environment variables from `.env.example` under **Settings → Environment Variables**. Set `NEXT_PUBLIC_SITE_URL` to your production URL.
3. Deploy. The cron job in `vercel.json` is registered automatically.
4. Add the Stripe production webhook (see above).

## Project structure

```
app/
  page.tsx                  Landing page
  book/                     Booking flow + Stripe return page
  track/  admin/  driver/   Customer, dispatch and driver apps
  api/
    quote/                  POST  server-side fare quote
    bookings/               POST  create booking / saved quote
    bookings/lookup/        POST  find booking by ref + contact
    bookings/[ref]/cancel/  POST  24-hour policy + Stripe refund
    stripe/payment-intent/  POST  re-price + create PaymentIntent
    stripe/confirm/         POST  verify payment after checkout
    stripe/webhook/         POST  payment_intent.succeeded, charge.refunded
    cron/flight-status/     GET   AirLabs pickup adjustments (CRON_SECRET)
    flights/                GET   flight status for /track
    auth/                   POST/GET/DELETE passcode sessions
    admin/…  driver/…       Dispatch and driver APIs (Supabase mode)
components/                 UI (home, book, track, admin, driver)
lib/
  config.ts                 Brand, airports, zones, fleet, flat-rate matrix
  pricing.ts                calculateQuote()
  policy.ts                 Cancellation rules
  validation.ts             Zod schemas
  server/                   Supabase repo, quote engine, Stripe, email, flights, auth
  client/                   API client + LocalStorage demo store
supabase/schema.sql         Tables, RLS, seed data
tests/                      Unit tests (npm test)
```

### Customising for another city

Edit `AIRPORTS`, `CITY_ZONES` and `SEDAN_FLAT_RATES` in `lib/config.ts`, plus the matching `sedan_rates` values in `supabase/schema.sql`. Other vehicle classes are priced as a multiple of the sedan rate (`flatRateMultiplier`), rounded to $5, and can be overridden per zone in `/admin → Flat Rates`.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Pricing, policy, time-zone and contact-matching tests |
