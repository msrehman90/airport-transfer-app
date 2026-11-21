-- ===========================================================================
-- Airport Transfer Booking App — Supabase / PostgreSQL schema + seed data
-- Run this whole file once in the Supabase SQL editor (it is idempotent).
-- ===========================================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 1. Vehicle classes --------------------------------------------------------
create table if not exists public.vehicle_classes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  max_passengers int not null,
  max_luggage int not null,
  hourly_rate numeric(10, 2) not null,
  min_hours int not null default 3,
  base_fare numeric(10, 2) not null,
  per_mile_rate numeric(10, 2) not null,
  image_url text,
  created_at timestamptz default now()
);

alter table public.vehicle_classes add column if not exists description text;
alter table public.vehicle_classes add column if not exists example_models text;
alter table public.vehicle_classes add column if not exists sort_order int not null default 0;

-- 2. City-to-airport flat rates ---------------------------------------------
create table if not exists public.flat_rates (
  id uuid primary key default gen_random_uuid(),
  airport_code text not null,
  city_zone text not null,
  vehicle_class_id uuid not null references public.vehicle_classes(id) on delete cascade,
  one_way_fare numeric(10, 2) not null,
  unique (airport_code, city_zone, vehicle_class_id)
);

-- 3. Drivers ----------------------------------------------------------------
create table if not exists public.drivers (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  license_number text,
  status text not null default 'available',
  created_at timestamptz default now()
);

-- 4. Fleet vehicles ---------------------------------------------------------
create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  vehicle_class_id uuid not null references public.vehicle_classes(id),
  make_model text not null,
  plate_number text not null unique,
  year int not null,
  driver_id uuid references public.drivers(id) on delete set null,
  status text not null default 'active'
);

-- 5. Bookings ---------------------------------------------------------------
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  service_type text not null check (service_type in ('to_airport', 'from_airport', 'hourly', 'point_to_point')),
  trip_type text not null check (trip_type in ('one_way', 'round_trip')),
  vehicle_class_id uuid not null references public.vehicle_classes(id),
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  pickup_address text not null,
  dropoff_address text,
  airport_code text,
  city_zone text,
  hours_booked int,
  passengers int not null default 1,
  luggage int not null default 0,
  scheduled_pickup_at timestamptz not null,
  adjusted_pickup_at timestamptz,
  flight_number text,
  flight_status text,
  return_pickup_at timestamptz,
  return_flight_number text,
  meet_and_greet boolean not null default false,
  child_seats int not null default 0,
  notes text,
  estimated_fare numeric(10, 2) not null,
  final_fare numeric(10, 2),
  stripe_payment_intent_id text,
  payment_status text not null default 'unpaid',
  status text not null default 'pending',
  driver_id uuid references public.drivers(id) on delete set null,
  vehicle_id uuid references public.vehicles(id) on delete set null,
  created_at timestamptz default now()
);

-- Extra columns used by the app (safe to re-run)
alter table public.bookings add column if not exists distance_miles numeric(10, 2);
alter table public.bookings add column if not exists pricing_method text;
alter table public.bookings add column if not exists is_quote boolean not null default false;
alter table public.bookings add column if not exists flight_checked_at timestamptz;
alter table public.bookings add column if not exists cancelled_at timestamptz;
alter table public.bookings add column if not exists refund_amount numeric(10, 2);
alter table public.bookings add column if not exists updated_at timestamptz default now();

create index if not exists idx_bookings_pickup on public.bookings (scheduled_pickup_at);
create index if not exists idx_bookings_ref on public.bookings (booking_ref);
create index if not exists idx_bookings_driver on public.bookings (driver_id);
create index if not exists idx_bookings_status on public.bookings (status);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_bookings_updated_at on public.bookings;
create trigger trg_bookings_updated_at
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- The Next.js server uses the service-role key (bypasses RLS). The anon key may
-- only read the public price list. Bookings, drivers and vehicles stay private.
-- ---------------------------------------------------------------------------
alter table public.vehicle_classes enable row level security;
alter table public.flat_rates enable row level security;
alter table public.drivers enable row level security;
alter table public.vehicles enable row level security;
alter table public.bookings enable row level security;

drop policy if exists "Public read vehicle classes" on public.vehicle_classes;
create policy "Public read vehicle classes" on public.vehicle_classes for select using (true);

drop policy if exists "Public read flat rates" on public.flat_rates;
create policy "Public read flat rates" on public.flat_rates for select using (true);

-- ===========================================================================
-- Seed data (mirrors lib/config.ts)
-- ===========================================================================

insert into public.vehicle_classes
  (slug, name, description, example_models, max_passengers, max_luggage, hourly_rate, min_hours, base_fare, per_mile_rate, sort_order)
values
  ('sedan',    'Luxury Sedan',      'Quiet, refined comfort for solo travelers and couples.', 'Volvo S90, Mercedes E-Class or similar', 4,  2,  70.00, 3,  45.00, 3.50, 1),
  ('suv',      'Executive SUV',     'Room for the whole family and their luggage.',           'Lexus LX, Chevrolet Suburban or similar',              6,  5,  90.00, 3,  65.00, 4.25, 2),
  ('escalade', 'Cadillac Escalade', 'Flagship luxury with first-class presence.',             'Cadillac Escalade or similar',                         6,  5, 110.00, 3,  85.00, 5.00, 3),
  ('sprinter', 'Mercedes Sprinter', 'Executive van for groups, teams and events.',            'Mercedes-Benz Sprinter or similar',                    13, 10, 145.00, 3, 120.00, 6.50, 4)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  example_models = excluded.example_models,
  max_passengers = excluded.max_passengers,
  max_luggage = excluded.max_luggage,
  hourly_rate = excluded.hourly_rate,
  min_hours = excluded.min_hours,
  base_fare = excluded.base_fare,
  per_mile_rate = excluded.per_mile_rate,
  sort_order = excluded.sort_order;

-- Flat rates: sedan fare per (zone, airport) x vehicle multiplier, rounded to $5.
with sedan_rates (city_zone, airport_code, sedan_fare) as (
  values
    ('dc_downtown', 'DCA', 65),  ('dc_downtown', 'IAD', 95),  ('dc_downtown', 'BWI', 110), ('dc_downtown', 'UNION_DC', 45),
    ('arlington', 'DCA', 60),    ('arlington', 'IAD', 90),    ('arlington', 'BWI', 115),   ('arlington', 'UNION_DC', 50),
    ('alexandria', 'DCA', 60),   ('alexandria', 'IAD', 100),  ('alexandria', 'BWI', 120),  ('alexandria', 'UNION_DC', 60),
    ('tysons', 'DCA', 75),       ('tysons', 'IAD', 75),       ('tysons', 'BWI', 125),      ('tysons', 'UNION_DC', 80),
    ('reston', 'DCA', 90),       ('reston', 'IAD', 65),       ('reston', 'BWI', 140),      ('reston', 'UNION_DC', 95),
    ('fairfax', 'DCA', 85),      ('fairfax', 'IAD', 75),      ('fairfax', 'BWI', 135),     ('fairfax', 'UNION_DC', 90),
    ('manassas', 'DCA', 110),    ('manassas', 'IAD', 90),     ('manassas', 'BWI', 160),    ('manassas', 'UNION_DC', 115),
    ('bethesda', 'DCA', 75),     ('bethesda', 'IAD', 95),     ('bethesda', 'BWI', 115),    ('bethesda', 'UNION_DC', 70),
    ('silver_spring', 'DCA', 75),('silver_spring', 'IAD', 105),('silver_spring', 'BWI', 100),('silver_spring', 'UNION_DC', 65),
    ('rockville', 'DCA', 90),    ('rockville', 'IAD', 95),    ('rockville', 'BWI', 120),   ('rockville', 'UNION_DC', 85),
    ('columbia', 'DCA', 115),    ('columbia', 'IAD', 135),    ('columbia', 'BWI', 75),     ('columbia', 'UNION_DC', 105),
    ('annapolis', 'DCA', 115),   ('annapolis', 'IAD', 155),   ('annapolis', 'BWI', 90),    ('annapolis', 'UNION_DC', 115),
    ('baltimore', 'DCA', 125),   ('baltimore', 'IAD', 155),   ('baltimore', 'BWI', 65),    ('baltimore', 'UNION_DC', 125)
),
multipliers (slug, multiplier) as (
  values ('sedan', 1.0), ('suv', 1.3), ('escalade', 1.6), ('sprinter', 2.2)
)
insert into public.flat_rates (airport_code, city_zone, vehicle_class_id, one_way_fare)
select s.airport_code, s.city_zone, vc.id, round(s.sedan_fare * m.multiplier / 5.0) * 5
from sedan_rates s
cross join multipliers m
join public.vehicle_classes vc on vc.slug = m.slug
on conflict (airport_code, city_zone, vehicle_class_id) do nothing;

-- Sample drivers and fleet (safe to delete in production)
insert into public.drivers (full_name, phone, email, license_number)
select * from (values
  ('Marcus Reed',   '+1 (202) 555-0181', 'marcus@example.com', 'DC-44817-MR'),
  ('Elena Vargas',  '+1 (703) 555-0122', 'elena@example.com',  'VA-90211-EV'),
  ('Daniel Okafor', '+1 (301) 555-0164', 'daniel@example.com', 'MD-55190-DO')
) as d(full_name, phone, email, license_number)
where not exists (select 1 from public.drivers);

insert into public.vehicles (vehicle_class_id, make_model, plate_number, year, driver_id)
select vc.id, v.make_model, v.plate_number, v.year, (select id from public.drivers where full_name = v.driver_name)
from (values
  ('sedan',    'Mercedes-Benz E 450',         'CEC-101', 2024, 'Marcus Reed'),
  ('suv',      'Chevrolet Suburban Premier',  'CEC-202', 2024, 'Elena Vargas'),
  ('escalade', 'Cadillac Escalade ESV',       'CEC-303', 2025, 'Daniel Okafor'),
  ('sprinter', 'Mercedes-Benz Sprinter 3500', 'CEC-404', 2023, null)
) as v(slug, make_model, plate_number, year, driver_name)
join public.vehicle_classes vc on vc.slug = v.slug
on conflict (plate_number) do nothing;
