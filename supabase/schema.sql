-- MediQueue Optima — Postgres schema (run this once in the Supabase SQL Editor)
--
-- Design notes for the report:
-- - Four normalized tables: departments, staff_users, visits, notifications.
-- - Foreign keys enforce referential integrity (a visit can't reference a
--   department that doesn't exist; a notification can't reference a staff
--   account that doesn't exist) — the concrete advantage of a relational
--   design over a JSON-blob or key-value store.
-- - IDs are human-readable text (e.g. "dept-outpatient", "visit-172...") to
--   match IDs already used throughout the running application, rather than
--   switching to opaque UUIDs.
-- - Row Level Security (RLS) is enabled on every table with NO permissive
--   policies attached, so the anon/public API key can read or write
--   NOTHING directly — every mutation goes through this Next.js app's own
--   server-side API routes, authenticated by session cookie, using the
--   Supabase *service role* key (which intentionally bypasses RLS). This is
--   the standard "server owns the database" pattern rather than exposing
--   the database directly to browsers.
--
-- Staff accounts (admin/doctor/receptionist demo logins) are NOT seeded
-- here in raw SQL, because their passwords need to go through this
-- project's own scrypt hashing function (src/lib/auth.ts) to be usable —
-- pasting a precomputed hash into SQL would be fragile and opaque. Instead,
-- the app seeds them automatically, once, the first time it queries an
-- empty staff_users table (see src/lib/server/user-store.ts). Just run this
-- schema, then log in with admin/admin123 as usual — the accounts will
-- exist by the time the login page loads.

-- ============================================================
-- 1. Departments — each one an independent M/M/c queue
-- ============================================================
create table if not exists departments (
    id           text primary key,
    name         text not null,
    category     text not null,
    description  text not null default '',
    lambda       numeric not null,       -- patient arrivals per hour
    mu           numeric not null,       -- patients served per hour, per doctor
    c            integer not null,       -- number of doctors (servers)
    nurse_count  integer not null default 0,
    status       text not null default 'Normal'
                 check (status in ('Normal', 'Warning', 'High Load', 'Critical')),
    created_at   timestamptz not null default now()
);

-- ============================================================
-- 2. Staff accounts (admin / doctor / receptionist)
-- ============================================================
create table if not exists staff_users (
    id             text primary key,
    name           text not null,
    username       text not null unique,
    password_hash  text not null,        -- scrypt hash, see src/lib/auth.ts
    role           text not null check (role in ('admin', 'doctor', 'receptionist')),
    department_id  text references departments(id) on delete set null,
    created_at     timestamptz not null default now()
);

-- ============================================================
-- 3. Patient visits — the real, event-sourced clinical record
-- ============================================================
create table if not exists visits (
    id                   text primary key,
    patient_name         text not null,
    -- ON DELETE RESTRICT, deliberately not CASCADE: a department with any
    -- patient visit history can never be deleted (the app enforces this
    -- with a friendlier error message too, in the DELETE /api/departments/
    -- [id] route, but this constraint is the backstop even against direct
    -- database access). Losing patient records as a side effect of tidying
    -- up a department list would be exactly the kind of silent data loss
    -- this whole persistence layer exists to prevent.
    department_id        text not null references departments(id) on delete restrict,
    department_name      text not null,   -- snapshot at check-in time, for historical accuracy
    reason               text not null,
    priority             text not null check (priority in ('Routine', 'Urgent', 'Emergency')),
    status               text not null check (status in ('WAITING', 'IN_CONSULTATION', 'COMPLETED', 'CANCELLED')),
    checked_in_at        timestamptz not null default now(),
    started_at           timestamptz,
    completed_at         timestamptz,
    assigned_doctor_id   text references staff_users(id) on delete set null,
    assigned_doctor_name text,
    checked_in_by        text not null,
    notes                text
);

create index if not exists idx_visits_department on visits(department_id);
create index if not exists idx_visits_status on visits(status);
create index if not exists idx_visits_checked_in_at on visits(checked_in_at desc);

-- ============================================================
-- 4. Per-user notifications (powers the Navbar notification bell)
-- ============================================================
create table if not exists notifications (
    id                text primary key,
    user_id           text not null references staff_users(id) on delete cascade,
    title             text not null,
    body              text not null,
    related_visit_id  text references visits(id) on delete set null,
    read              boolean not null default false,
    created_at        timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id);

-- ============================================================
-- Row Level Security — lock out direct client access entirely.
-- ============================================================
alter table departments enable row level security;
alter table staff_users enable row level security;
alter table visits enable row level security;
alter table notifications enable row level security;

-- ============================================================
-- Seed data — the Massey Street Children's Hospital case study
-- (mirrors src/lib/hospital-data.ts; see the About page in the app for
-- sourcing/assumptions notes)
-- ============================================================
insert into departments (id, name, category, description, lambda, mu, c, nurse_count, status) values
    ('dept-outpatient', 'General Outpatient / Paediatric Clinic', 'Outpatient',
     'First point of contact for walk-in paediatric patients - triage, routine consultations and referrals.',
     14, 5, 3, 12, 'Normal'),
    ('dept-emergency', 'Emergency Room', 'Emergency',
     'Acute paediatric emergency care, including the hospital''s outborn emergency cots.',
     8, 3, 2, 7, 'Normal'),
    ('dept-neonatal', 'Neonatal & Maternity Unit', 'Neonatal',
     'Outborn neonatal care with incubators and cots, linked to the Lagos Island Maternity Hospital inborn unit.',
     5, 2.5, 2, 6, 'Normal'),
    ('dept-surgery', 'General Surgery', 'Surgery',
     'Elective and emergency paediatric surgical procedures.',
     2, 1.8, 1, 3, 'Warning'),
    ('dept-specialist', 'Cardiology & Specialist Clinics', 'Specialist',
     'Combined specialist outpatient bloc covering cardiology, endocrinology, orthopaedics and nutrition.',
     6, 3, 2, 2, 'Normal'),
    ('dept-obgyn', 'Obstetrics & Gynaecology', 'Maternity',
     'Antenatal, delivery and postnatal care, run jointly with the adjoining Lagos Island Maternity Hospital.',
     3, 2.2, 1, 1, 'Warning')
on conflict (id) do nothing;
