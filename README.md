# MediQueue Optima — M/M/c Multi-Server Queuing Model for Hospital Appointment Systems

> Case Study: **Massey Street Children's Hospital, Lagos Island, Lagos State, Nigeria**

A web-based analytical, simulation, and machine-learning system for modelling and optimising
hospital patient flow using Kendall's **M/M/c queueing theory**, validated by discrete-event
simulation and extended with a regression-based demand forecasting model.

![Version](https://img.shields.io/badge/version-0.2.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)

---

## Table of Contents

1. [What this project is](#1-what-this-project-is)
2. [What changed in this revision](#2-what-changed-in-this-revision)
3. [Theoretical background — the M/M/c model](#3-theoretical-background--the-mmc-model)
4. [Case study — Massey Street Children's Hospital](#4-case-study--massey-street-childrens-hospital)
5. [System architecture](#5-system-architecture)
6. [Pages](#6-pages)
7. [Machine learning module](#7-machine-learning-module)
8. [Systematic validation against theory](#8-systematic-validation-against-theory)
9. [Getting started](#9-getting-started)
10. [Verifying correctness](#10-verifying-correctness)
11. [API reference](#11-api-reference)
12. [Known limitations (read before writing your report)](#12-known-limitations-read-before-writing-your-report)
13. [Project structure](#13-project-structure)
14. [Deploying to Vercel](#14-deploying-to-vercel)

---

## 1. What this project is

MediQueue Optima applies the **M/M/c (Erlang-C) queueing model** to hospital outpatient and
emergency department operations, so a hospital administrator can answer: *how many doctors does
this department need so patients wait no longer than X minutes, on average?* It:

- Computes exact steady-state performance metrics analytically (`P0`, `Lq`, `Wq`, `L`, `W`, `ρ`).
- Validates those analytical results with a discrete-event simulation, run as multiple independent
  replications with a 95% confidence interval — not a single noisy sample path.
- Automatically solves for the minimum number of servers (doctors) needed to meet a wait-time SLA.
- Forecasts each department's hourly patient arrival rate with a small, fully transparent ML model,
  and turns that forecast directly into an hour-by-hour staffing recommendation.
- Presents all of this through a dashboard, a live departments view, and a reports/export module.

## 2. What changed in this revision

**This is the second major revision.** In addition to everything from the first rebuild (removing
the Supabase crash, fixing the build's Google Fonts dependency, grounding the app in the Massey
Street Children's Hospital case study, rewriting the simulation engine, adding the ML forecast and
About page), this revision:

### Fixed reported bugs
- **Number inputs silently concatenating instead of replacing** (typing "1" over a default "10"
  produced "101"/"01"): every numeric input across the app was a plain controlled `<input>` with no
  "select all on focus" behavior, so typing didn't replace the existing value — the browser default
  is to insert at the cursor. Fixed with a shared `NumberField` component
  (`src/components/ui/NumberField.tsx`) that selects the field's contents on focus.
- **Optimization page crashing when inputs were changed from their defaults**: `optimizeServers()`
  had an unvalidated `maxC` parameter. If `maxC` reached `0` (e.g. from a cleared/invalid form
  field — exactly the kind of state the input bug above could produce), the function's "not found"
  fallback called `calculateMMC(lambda, mu, 0)`, which correctly rejects a zero server count by
  *throwing* — crashing the whole request with an unhandled 500 error instead of a clean "no
  solution found" response. Fixed in both `src/lib/optimization.ts` (the function now clamps `maxC`
  so it can never throw) and `src/app/api/queue/optimize/route.ts` (server-side validation, defense
  in depth).
- **Notification bell and profile icon doing nothing when clicked**: they were static, unwired
  `<button>`/`<div>` elements with no `onClick`, no dropdown, and hardcoded "Dr. Admin" text. Rebuilt
  as real, working dropdowns backed by an actual authentication session and a live notification
  feed (see below).
- **"Run Today's Snapshot" doing nothing perceptible**: that button ran a simulation and silently
  wrote a fake report entry with no visible confirmation. It has been removed entirely — see "No
  more mock data" below for why, and what replaced it.

### No more mock data, anywhere
Every seeded/synthetic dataset has been removed:
- The synthetic 14-day report history (`report-store.ts`) is gone. Reports and the Dashboard now
  compute exclusively from a real, event-sourced **patient visit log** (`src/lib/server/visit-store.ts`)
  that starts genuinely empty and only contains data from real check-ins performed in the running
  app. An empty store now correctly renders an honest "no data yet" state instead of invented numbers.
- The synthetic 21-day ML training set (`synthetic-history.ts`) is gone. The ML forecaster
  (`src/lib/ml/forecast.ts`) now trains only on the hour-of-day of real logged check-ins, and
  requires a minimum amount of real history (20 visits across 2+ distinct days) before it will
  produce a forecast — if that bar isn't met, it says so explicitly (`sufficientData: false`)
  instead of ever showing a fabricated curve.
- The λ/μ parameters configured per department remain clearly labeled, honest **planning estimates**
  for capacity-what-if analysis (see the About page's "real vs. planning data" section) — they were
  never claimed to be real-time data, and that distinction is now enforced throughout the UI as well
  as documented explicitly.

### A real, role-based, real-time patient-flow system
This was the core of this revision — turning the app from a queueing-theory calculator into an
operational system that models how a hospital department actually runs, informed by how commercial
hospital queue-management systems are structured (digital check-in → live queue → automatic
clinician notification, e.g. Ezovion, Qwaiting, DoctoPlus):

- **Authentication & roles** (`admin`, `doctor`, `receptionist`) via a small, dependency-free
  implementation on Node's built-in `crypto` (scrypt password hashing, HMAC-signed session cookies)
  — see `src/lib/auth.ts`. Route protection is enforced centrally in `src/proxy.ts` (renamed from
  the deprecated `middleware.ts` convention per Next.js 16).
- **Reception page** (`/reception`) — checks a patient in once: name, department, reason for
  visit/symptoms, and a triage priority (Routine/Urgent/Emergency). No further re-asking is needed.
- **Doctor page** (`/doctor`) — a live, priority-ordered queue for the doctor's own department, with
  the full reason-for-visit text captured by reception, "Start"/"Complete" consultation actions, and
  a running list of patients completed that day.
- **Real-time notifications**: the moment a receptionist checks a patient in, every doctor assigned
  to that department is notified instantly — no polling, no page refresh — via **Server-Sent Events**
  (`src/app/api/events/stream/route.ts`, `src/lib/server/event-bus.ts`). SSE was chosen deliberately
  over WebSockets: this app's real-time needs are one-directional (server → client push), which is
  exactly what SSE is for, and it needs no custom server or extra client library, unlike WebSockets.
- **Admin Staff Management** (`/admin/staff`) — create and manage doctor/receptionist accounts, each
  assigned to a department, from the admin account.
- The Navbar's notification bell and profile menu are now fully functional: the bell shows real,
  live notifications (with unread counts and mark-as-read), and the profile dropdown shows the
  actual logged-in user's name and role with a working sign-out.

### Research grounding for this revision
Architectural choices above were informed by research into commercial hospital queue-management
system design (digital check-in, real-time dashboards, clinician notification workflows — Ezovion,
Qwaiting, DoctoPlus, INDUROCK), Next.js App Router real-time patterns (Server-Sent Events vs.
WebSockets), and Next.js App Router authentication/middleware best practices for 2026.

### Third revision: systematic validation, and a real bug it found
Prompted by an explicit check against the project's stated objectives, this revision adds:

- **`src/proxy.ts`** (renamed from `middleware.ts`) — Next.js 16 deprecated the `middleware.ts` file
  convention in favor of `proxy.ts`; the old name still worked but printed a build-time deprecation
  warning. Functionally identical, just on the current supported convention.
- **The Validation page** (`/validation`) — runs the discrete-event simulation against ten parameter
  configurations (light/moderate/heavy/near-critical utilization at c=1,2,3,4) and reports simulated
  vs. theoretical error for every metric, with pass/fail against a 15% tolerance. This exists
  specifically to make the project's accuracy-validation objective a demonstrable, reproducible
  system feature instead of a single manual comparison on the Simulation page.
- **Building that page surfaced a genuine simulation bug**: the engine was letting the queue drain
  to empty *past* the requested duration, and counting that low-queue "drain tail" into the reported
  averages. Because a busier system takes longer to drain, this biased simulated Lq/Wq **downward**,
  worse the higher the utilization — exactly the pattern the validation sweep exposed (heavy-load
  configurations were off by 40–55%, light-load configurations by only a few percent). Fixed in
  `src/lib/simulation.ts` by clipping the measurement window to a fixed `[warm-up, duration]` horizon
  and breaking out of the event loop once that horizon is reached, and by making the warm-up period
  scale with duration (`duration × 0.15`) instead of being capped at a flat 1 hour that was nowhere
  near long enough for a near-saturated (ρ≈0.95) system to leave its empty-start transient. After
  both fixes: mean absolute percent error across the ten configurations dropped from ~20% to ~4%,
  and 9 of 10 pass the 15% tolerance band outright — the one that doesn't (ρ≈0.95) is the textbook
  hard case for finite-horizon queueing simulation and is discussed as such on the Validation page,
  not hidden.

### Fourth revision: a real, owned Postgres database
The previous revision made persistence *possible* via an optional Redis add-on. This revision
replaces that entirely with a proper normalized Postgres schema (`supabase/schema.sql` — four
tables, foreign key constraints, Row Level Security locked down to server-only access), provisioned
through a Supabase account independent of Vercel rather than through Vercel's own storage
marketplace — so the database is fully owned and portable, not tied to a specific host. Every store
(`department-store.ts`, `user-store.ts`, `visit-store.ts`, `notification-store.ts`) now maps directly
onto real SQL rows via `src/lib/server/db.ts`, while keeping the same in-memory fallback for
zero-setup local development. No API route changes were needed for this migration — the store
functions were already async from the Redis revision, so only their internals changed.

## 3. Theoretical background — the M/M/c model

| Parameter | Meaning |
|---|---|
| **λ** | Mean patient arrival rate (patients/hour), Poisson process |
| **μ** | Mean service rate per server (patients/hour), exponential service time |
| **c** | Number of parallel servers (doctors) |
| **ρ** | Utilization = λ / (c·μ). System is stable only if ρ < 1 |
| **P₀** | Probability the system is empty |
| **Lq** | Mean number of patients waiting in queue |
| **Wq** | Mean waiting time in queue (Little's Law: Wq = Lq / λ) |
| **L, W** | Mean number/time in the full system (queue + service) |

**Worked example** (λ=10 patients/hr, μ=4 patients/hr/doctor, c=3 doctors):

```
ρ  = 10 / (3×4)     = 0.8333
P0                   = 0.0449
Lq                   = 3.5112
Wq (hours)           = 0.3511   →  21.07 minutes
L                    = 6.0112
W  (hours)           = 0.6011   →  36.07 minutes
```

Run `npm run verify:mmc` to see this (and two other reference cases) checked automatically against
the implementation in `src/lib/mmc.ts`.

## 4. Case study — Massey Street Children's Hospital

Massey Street Children's Hospital (MSCH) is an 85-bed, Lagos State Government-owned paediatric
hospital on Massey Street, Lagos Island. Opened in 1914 as Lagos's first general outpatient clinic,
it became Lagos's first maternity hospital in 1926, and was converted into a dedicated children's
hospital in 1961 — making it the oldest children's hospital in the West African sub-region.

The six departments modelled in this system, and the doctor/nurse counts used to seed them, are
informed by MSCH's publicly reported clinical staff composition (2 consultant
paediatricians/neonatologists, 1 senior registrar, 4 registrars, and 31 nursing staff across
services including endocrinology, orthopaedics, nutrition, obstetrics & gynaecology, cardiology,
general surgery and optometry). Full source list and an important methodological caveat about the
arrival/service rate assumptions are on the **[About page](/about)** — please read that section
before quoting these numbers as measured data in your report; they are transparent, documented
estimates, not scraped hospital records (see [section 11](#12-known-limitations-read-before-writing-your-report)).

## 5. System architecture

```
┌──────────────────────────── Browser (Next.js App Router, client components) ────────────────────────────┐
│  /  /login  /dashboard  /reception  /doctor  /admin/staff  /departments  /simulation  /optimization       │
│  /forecast  /validation  /reports  /about                                                                  │
└───────────────────────────────────────┬────────────────────────────────────────────────────────────────┘
                                         │ fetch (REST) + SSE (/api/events/stream)
┌────────────────────────────────────────▼───────────────────────────────────────────────────────────────┐
│           src/proxy.ts — session-cookie auth + role-based route protection (all routes except           │
│                            /, /login, /about, /api/auth/*)                                                │
├────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                Next.js API Route Handlers (src/app/api/**)                                │
│   /api/queue/{calculate,simulate,optimize}       /api/departments (+/[id])      /api/validation           │
│   /api/ml/forecast     /api/reports     /api/visits (+/[id])     /api/staff (+/[id])                      │
│   /api/notifications (+/[id]/read)     /api/events/stream     /api/auth/{login,logout,me}                 │
└──────────┬───────────────────┬──────────────────────┬──────────────────────┬─────────────────────────────┘
           ▼                   ▼                      ▼                      ▼
     src/lib/mmc.ts     src/lib/simulation.ts   src/lib/optimization.ts   src/lib/ml/forecast.ts
   (analytical engine)  (discrete-event sim,     (min-c solver)          (harmonic regression +
                          heap, seeded RNG,                                optimizeServers, trained
                          fixed-horizon window,                            on real check-ins only)
                          replications)                src/lib/validation.ts
                                                    (systematic sim-vs-theory sweep)
           │
           ▼
  src/lib/server/{department,report,user,visit,notification}-store.ts, event-bus.ts, session.ts
  (in-memory data layer, seeded from src/lib/hospital-data.ts; visits/reports start genuinely empty)
```

## 6. Pages

| Route | Role | Purpose |
|---|---|---|
| `/` | Public | Landing page |
| `/login` | Public | Staff sign-in (see default accounts below) |
| `/dashboard` | All staff | Real-time overview: today's real check-ins, waiting/in-consultation counts, actual average wait |
| `/reception` | Receptionist, Admin | Check a patient in once (name, department, reason, priority); live queue view |
| `/doctor` | Doctor, Admin | Live, priority-ordered queue for the doctor's department; start/complete consultations |
| `/admin/staff` | Admin | Create and manage doctor/receptionist accounts, assigned to departments |
| `/departments` | Admin | Live list of departments as independent M/M/c queues; add/remove departments |
| `/simulation` | All staff | Configure λ, μ, c, duration, replications, seed; discrete-event engine vs. theory with confidence intervals |
| `/optimization` | All staff | Finds the minimum doctor count that meets a target wait-time SLA |
| `/forecast` | All staff | ML demand forecast (trained on real check-ins only) → dynamic hourly staffing recommendation |
| `/validation` | All staff | Systematic simulation-vs-theory comparison across 10 parameter configurations (§8) |
| `/reports` | All staff | Real, event-sourced report history; CSV export; print/PDF export |
| `/about` | Public | Full project write-up: theory, case study, methodology, ML approach, real-time architecture, sources, limitations |

### Default accounts (change via Staff Management)

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Doctor (General Outpatient) | `dr.adeyemi` | `doctor123` |
| Receptionist (General Outpatient) | `reception1` | `reception123` |

## 7. Machine learning module

Hospital arrivals follow a strong daily cycle that a constant-λ M/M/c model can't capture on its
own. `/forecast` trains a small, fully transparent **harmonic linear regression**:

```
λ(h) ≈ b0 + b1·sin(2πh/24) + b2·cos(2πh/24) + b3·sin(4πh/24) + b4·cos(4πh/24) + b5·isWeekend
```

Coefficients are solved in closed form via the normal equations (ordinary least squares — no
external ML library, no black box; every coefficient is directly interpretable). It trains
**exclusively on the hour-of-day of real check-ins** logged via the Reception page — there is no
synthetic or seeded training set. Because a fresh deployment starts with zero visits, the model
requires a minimum amount of real history (20 check-ins across at least 2 distinct days) before it
will train; if that bar isn't met, it returns `sufficientData: false` and the UI says so honestly,
rather than ever fabricating a curve.

The resulting 24-hour λ(t) prediction is then fed directly into `optimizeServers` (the same
minimum-server solver used on the Optimization page) to produce a genuine hybrid
**ML forecast → queueing-theory staffing plan**, rather than two disconnected features.

## 8. Systematic validation against theory

Rather than checking simulation-vs-theory agreement on a single ad-hoc case, `/validation` runs it
systematically across ten configurations spanning light, moderate, heavy, and near-critical
utilization at c = 1, 2, 3, and 4 servers — 50 replications of a 150-hour simulated horizon each, to
keep confidence intervals tight even for the highest-variance (single-server, heavy-load) cases.

As of this revision: **mean absolute percent error ≈ 4%, 9 of 10 configurations pass a 15% tolerance
band outright.** The one that doesn't (ρ≈0.95) is the textbook hard case for finite-horizon queueing
simulation — very slow convergence to steady state near saturation — and is discussed as such on the
page itself rather than hidden. Building this page is also what surfaced a genuine bug in the
simulation engine (see §2, third revision) — worth mentioning in your report as evidence of the
validation process actually doing its job, not just passing by construction.

## 9. Getting started

### Prerequisites
- Node.js ≥ 18.x, npm ≥ 9.x

### Installation

```bash
git clone <repository-url>
cd multi-server-modelling
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No environment variables or database setup are
required — the app runs entirely on an in-memory data layer seeded with the case-study departments.

### Available scripts

| Command | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm start` | Start production server |
| `npm run lint` | ESLint |
| `npm run verify:mmc` | Verify the analytical engine against reference Erlang-C values |

`dev` and `start` run through `cross-env` to set
`NODE_OPTIONS="--dns-result-order=ipv4first --no-network-family-autoselection"`. This works around a
well-documented Node.js/undici bug (Node's `fetch()` implementation since v18-20 races an IPv6
connection attempt first via "Happy Eyeballs," which hangs and fails as `TypeError: fetch failed` on
many Windows machines where IPv6 resolves but doesn't actually route anywhere — even though a browser
on the same machine connects instantly, since browsers handle that fallback correctly). This
specifically affects `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` calls made from `src/lib/server/db.ts`
during local development. It's a no-op on machines/environments that don't have this issue, and
doesn't apply to the Vercel deployment itself (Vercel's own infrastructure doesn't run this `start`
script — it builds and serves the app through its own runtime).

## 10. Verifying correctness

```bash
npm run verify:mmc
```

This checks `src/lib/mmc.ts` against three independently hand-computable reference cases (a
3-server case, a lighter-load 3-server case, and an M/M/1 sanity check) and reports PASS/FAIL per
metric with the numeric difference. Use this output as evidence of correctness in your report's
verification/testing section, alongside the simulation-vs-theory comparison on the Simulation page.

## 11. API reference

All endpoints are `POST` (except the `GET`s noted) and return JSON. Every endpoint except
`/api/auth/*` requires a valid session cookie (enforced centrally in `src/middleware.ts`).

**Auth**
- **`/api/auth/login`** — `{ username, password }` → sets session cookie, returns `{ id, name, role, departmentId }`
- **`/api/auth/logout`** — clears the session cookie
- **`/api/auth/me`** — `GET`, returns the current session or 401

**Staff (admin only)**
- **`/api/staff`** — `GET` lists all staff; `POST { name, username, password, role, departmentId? }` creates one
- **`/api/staff/[id]`** — `PUT` updates; `DELETE` removes (the seed admin account can't be deleted)

**Patient visits**
- **`/api/visits`** — `GET` (optional `?departmentId=&status=`) lists visits; `POST { patientName, departmentId, reason, priority }` checks a patient in (receptionist/admin only) and notifies assigned doctors
- **`/api/visits/[id]`** — `PUT { action: "start" | "complete" | "cancel", notes? }` transitions a visit (doctor/admin only)

**Real-time**
- **`/api/events/stream`** — `GET`, Server-Sent Events stream of `visit:created`, `visit:updated`, and `notification:new` events
- **`/api/notifications`** — `GET` lists the current user's notifications; `POST` marks them all read
- **`/api/notifications/[id]/read`** — `POST` marks a single notification read

**Queueing engine**
- **`/api/queue/calculate`** — `{ lambda, mu, c }` → `MMCResults`
- **`/api/queue/simulate`** — `{ lambda, mu, c, duration, replications?, warmUpHours?, seed? }` →
  `ReplicatedSimulationResult` (mean ± 95% CI per metric, plus a representative event log)
- **`/api/queue/optimize`** — `{ lambda, mu, targetWq, maxC? }` → `OptimizationResult`
- **`/api/departments`** — `GET` lists all departments with live metrics; `POST` creates one (admin only)
- **`/api/departments/[id]`** — `PUT` updates; `DELETE` removes (admin only)
- **`/api/reports`** — `GET` (optional `?departmentId=`) returns real report history + today's live summary
- **`/api/ml/forecast`** — `{ departmentId, targetWqMinutes? }` → `ForecastResult` (`sufficientData: false` if not enough real history yet)

## 12. Known limitations (read before writing your report)

Be upfront about these in your methodology/limitations section — it will read as rigor, not weakness:

1. **λ and μ per department remain documented planning estimates, not measured data** — see the
   About page's "real vs. planning data" section for the full explanation of this distinction, which
   is now enforced throughout the UI, not just stated in documentation.
2. **Data persistence is opt-in via Postgres, and falls back to server process memory if not
   configured.** Locally (`npm run dev`) and in any deployment without a linked Supabase database,
   all real data (departments, staff, visits, notifications) resets on restart and isn't shared
   across serverless instances. Running `supabase/schema.sql` against a Supabase project and setting
   `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (see section 14, Deploying to Vercel) makes all of it
   genuinely durable in a normalized relational schema — check `GET /api/health` on any running
   instance to confirm which mode it's in. The SSE event bus (instant notification delivery) is
   intentionally NOT moved to Postgres — see its own doc comment in `src/lib/server/event-bus.ts` for
   why that's a reasonable scope boundary even with a database configured, and what the multi-instance
   upgrade path would be.
3. **The ML forecaster needs real usage before it's useful.** A fresh deployment has zero visits, so
   the Forecast page will correctly report "not enough data yet" until Reception has been used
   across at least 2 days. This is intentional honesty, not a bug — see section 7.
4. **M/M/c assumes Poisson arrivals and exponential service times.** Real hospital service times are
   often better modelled by other distributions (e.g. log-normal); this is a standard, explicitly
   acknowledged simplifying assumption in queueing-theory applications to healthcare, not unique to
   this project.
5. Each department models doctors as the M/M/c "servers"; nurses assist service delivery but are
   not modelled as separate parallel servers (a standard simplification for a single-class M/M/c model).
6. **Authentication is a small, dependency-free implementation appropriate for a coursework demo**,
   not a production-grade auth provider — no rate limiting on login attempts, no password reset flow,
   a single hardcoded fallback session secret if `SESSION_SECRET` isn't set in the environment. See
   the security note in `src/lib/auth.ts` for what a production deployment would add.

## 13. Project structure

```
multi-server-modelling/
├── scripts/
│   └── verify-mmc.ts              # Automated correctness check vs. reference values
├── src/
│   ├── middleware.ts               # Session/role route protection (runs on the Node.js runtime)
│   ├── hooks/
│   │   ├── useSession.ts            # Current logged-in user
│   │   ├── useNotifications.ts      # SSE-backed live notification bell
│   │   └── useVisitEvents.ts        # Real-time queue refresh on visit create/update
│   ├── app/
│   │   ├── page.tsx                        # Landing page
│   │   ├── layout.tsx                       # Root layout (no external font dependency)
│   │   ├── login/page.tsx                   # Staff sign-in
│   │   ├── about/page.tsx                   # Project write-up, case study, sources
│   │   ├── dashboard/page.tsx                # Real-time overview (real data only)
│   │   ├── reception/page.tsx                # Patient check-in + live queue
│   │   ├── doctor/page.tsx                   # Doctor's live queue + consultation actions
│   │   ├── admin/staff/page.tsx              # Staff account management (admin)
│   │   ├── departments/page.tsx              # Live department CRUD + M/M/c metrics (admin)
│   │   ├── simulation/page.tsx               # Discrete-event simulation UI
│   │   ├── optimization/page.tsx             # Minimum-server solver UI
│   │   ├── forecast/page.tsx                 # ML demand forecast UI (real-data-only)
│   │   ├── reports/page.tsx                  # Real report history, CSV/PDF export
│   │   └── api/
│   │       ├── auth/{login,logout,me}/route.ts
│   │       ├── staff/route.ts, [id]/route.ts
│   │       ├── visits/route.ts, [id]/route.ts
│   │       ├── events/stream/route.ts        # Server-Sent Events
│   │       ├── notifications/route.ts, [id]/read/route.ts
│   │       ├── queue/{calculate,simulate,optimize}/route.ts
│   │       ├── departments/route.ts, [id]/route.ts
│   │       ├── reports/route.ts
│   │       └── ml/forecast/route.ts
│   ├── lib/
│   │   ├── auth.ts                  # Password hashing (scrypt) + signed session tokens (HMAC)
│   │   ├── mmc.ts                   # Analytical M/M/c engine (Erlang-C)
│   │   ├── simulation.ts            # Discrete-event simulator (heap, seeded RNG, replications)
│   │   ├── optimization.ts          # Minimum-server solver (hardened against invalid maxC)
│   │   ├── random.ts                # Seeded PRNG + sampling utilities
│   │   ├── hospital-data.ts         # Case-study seed data + sources
│   │   ├── server/
│   │   │   ├── db.ts                 # Postgres (Supabase)-or-in-memory persistence abstraction (see section 14)
│   │   │   ├── session.ts            # Server-side session read/validation helper
│   │   │   ├── department-store.ts   # Department CRUD, persisted through db.ts
│   │   │   ├── user-store.ts         # Staff accounts (seeded admin/doctor/receptionist), persisted through db.ts
│   │   │   ├── visit-store.ts        # REAL patient visit log — the single source of truth for real data
│   │   │   ├── notification-store.ts # Per-user persisted notifications
│   │   │   ├── event-bus.ts          # In-process pub-sub powering SSE (deliberately NOT in Postgres — see file)
│   │   │   └── report-store.ts       # Reports computed entirely from visit-store (no synthetic data)
│   │   └── ml/
│   │       └── forecast.ts           # Harmonic regression trained on real check-ins only
│   ├── components/
│   │   ├── layout/{Navbar,Sidebar}.tsx      # Role-aware nav, working notification/profile dropdowns
│   │   ├── ui/NumberField.tsx                # Bug-fixed numeric input (select-on-focus)
│   │   └── queue/ResultsCard.tsx
│   └── types/queue.ts               # Shared TypeScript interfaces (single source of truth)
├── package.json
└── next.config.ts
```

## 14. Deploying to Vercel

The app is a standard Next.js 16 App Router project — `vercel --prod` or a GitHub import both work
with no configuration beyond what's described here. Two things are worth understanding first:

**`src/proxy.ts` needs the Node.js runtime, not Edge.** As of Next.js 16 this is the default for
`proxy.ts` (unlike the old `middleware.ts`, which defaulted to Edge), so no extra config is needed —
just don't add `export const runtime = "edge"` to it.

**Data persistence is opt-in, via a Supabase (Postgres) database you own independently of Vercel.**
Without any extra setup, the app deploys and runs correctly, but every store (departments, staff,
visits, notifications) lives in that serverless invocation's memory — fine for the
Simulation/Optimization/Forecast/Validation pages (they're stateless calculators), but the
Reception → Doctor → Reports patient workflow may appear to "forget" data between visits, because
Vercel can spin up a fresh instance with empty memory at any time. To make everything durable:

1. Create a free project at [supabase.com](https://supabase.com) — this is a completely independent
   company/account from Vercel; nothing here goes through Vercel's own Storage/Marketplace tab, so
   you fully own this database and could point a different host at it later with no lock-in.
2. In your new Supabase project, open the **SQL Editor** and run the entire contents of
   `supabase/schema.sql` (in this repo) once. This creates four normalized tables — `departments`,
   `staff_users`, `visits`, `notifications` — with foreign key constraints between them, and seeds
   the case-study departments. Staff accounts (admin/doctor/receptionist demo logins) are seeded
   automatically by the app itself the first time it queries an empty `staff_users` table, not by
   this SQL file — see the comment at the top of `schema.sql` for why.
3. In Supabase, go to **Project Settings → API** and copy the **Project URL** and the
   **`service_role` secret key** (not the `anon` public key — the service role key is what lets the
   server bypass Row Level Security, which is deliberately locked down with no public policies; see
   `schema.sql`'s comments).
4. In your Vercel project → **Settings → Environment Variables**, add:
   ```
   SUPABASE_URL=<your Supabase Project URL>
   SUPABASE_SERVICE_ROLE_KEY=<your service_role secret key>
   ```
5. Redeploy. Every store now reads/writes through real Postgres instead of in-memory arrays —
   confirmed live by hitting `GET /api/health`, which reports
   `"storage": "persistent (Postgres/Supabase)"` once this is wired up correctly, or
   `"in-memory (resets on cold start / restart)"` if it isn't.

To use the same persistent database from `npm run dev` locally (so local testing doesn't reset every
time you restart the dev server either), copy the same two values into a local `.env.local` file —
see `.env.local.example`. **Never commit `SUPABASE_SERVICE_ROLE_KEY` to git** — it grants full
read/write access to every table, bypassing all access controls; `.env.local` is already gitignored.

Also worth setting explicitly in Production environment variables (optional but recommended for a
shared deployment, not just local use):

```
SESSION_SECRET=<any long random string — used to sign login sessions>
```

If unset, a hardcoded development fallback is used (see the security note in `src/lib/auth.ts`) —
fine for a quick local test, not ideal for a link you're sharing with someone else.

**One remaining limitation even with Postgres configured:** the "instant" notification bell and live
queue updates run over Server-Sent Events backed by an in-process event emitter
(`src/lib/server/event-bus.ts`), which is intentionally *not* moved to the database (see that file's
doc comment for why). If two people are using a deployed instance at the same time and Vercel routes
them to different serverless instances, real-time push between them may lag — but the underlying data
is correct and consistent either way (Postgres-backed), and a page refresh always shows the true state.

---

*Academic project in Operations Research and Healthcare Systems Engineering.*
