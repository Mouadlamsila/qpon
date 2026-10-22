-- Orkesta — schema + RLS (PLAN_TECHNIQUE §4)
-- Multi-tenant : chaque table porte restaurant_id. RLS = seule sécurité.
-- Idempotent : ON CONFLICT DO NOTHING / DROP IF EXISTS.

-- Extensions
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- 1. Organizations (restaurants gérés par Foued)
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- 2. Profiles (map auth.users -> role + tenant)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'server_restaurant' check (role in ('admin_foued','server_restaurant')),
  organization_id uuid references public.organizations(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 3. Devices (pairing tablette -> restaurant, revocable)
create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  pairing_code text not null,
  status text not null default 'active' check (status in ('active','revoked')),
  last_seen timestamptz,
  created_at timestamptz not null default now()
);

-- 4. Zones (flyers par zone colorée)
create table if not exists public.zones (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text not null,
  color text not null,
  flyers_distributed int not null default 0,
  created_at timestamptz not null default now()
);

-- 5. Promos
create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  price_place numeric not null default 0,
  price_delivery numeric not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- 6. Orders — client_uuid = clé d'idempotency (UNIQUE)
create table if not exists public.orders (
  id uuid primary key, -- = client_uuid généré côté client
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete restrict,
  promo_id uuid not null references public.promos(id) on delete restrict,
  channel text not null check (channel in ('SUR_PLACE','LIVRAISON','UBER','TAKEAWAY','APPLI')),
  amount numeric not null default 0,
  client_last4 text,
  created_at timestamptz not null default now(),
  synced_at timestamptz not null default now()
);
-- Idempotency : PK sur id déjà garantit 1 seule ligne par client_uuid.

-- 7. Campaigns (coût pour ROI)
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  cost numeric not null default 0,
  start_date date not null default current_date,
  end_date date,
  created_at timestamptz not null default now()
);

-- Index
create index if not exists idx_zones_org on public.zones(restaurant_id);
create index if not exists idx_promos_org on public.promos(restaurant_id);
create index if not exists idx_orders_org_created on public.orders(restaurant_id, created_at desc);
create index if not exists idx_devices_rest on public.devices(restaurant_id);

-- ============================================================
-- RLS helpers (security definer = lis le profil sans boucle RLS)
-- ============================================================
create or replace function public.me_role() returns text
language sql security definer stable as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.me_org() returns uuid
language sql security definer stable as $$
  select organization_id from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql security definer stable as $$
  select coalesce((select role = 'admin_foued' from public.profiles where id = auth.uid()), false);
$$;

-- ============================================================
-- RLS policies
-- ============================================================
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.zones enable row level security;
alter table public.promos enable row level security;
alter table public.orders enable row level security;
alter table public.campaigns enable row level security;

-- Profiles : chacun lit/écrit le sien. Admin lit tout.
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid() or public.is_admin());

-- Organizations : membre du tenant voit le sien. Admin voit tout.
drop policy if exists orgs_read on public.organizations;
create policy orgs_read on public.organizations for select using (
  public.is_admin() or id = public.me_org()
);

-- Zones / Promos / Orders / Campaigns / Devices : tenant isolation.
-- Admin (Foued) = bypass pour dashboard multi-restaurants.
drop policy if exists zones_tenant on public.zones;
create policy zones_tenant on public.zones for all
  using (public.is_admin() or restaurant_id = public.me_org())
  with check (public.is_admin() or restaurant_id = public.me_org());

drop policy if exists promos_tenant on public.promos;
create policy promos_tenant on public.promos for all
  using (public.is_admin() or restaurant_id = public.me_org())
  with check (public.is_admin() or restaurant_id = public.me_org());

drop policy if exists orders_tenant on public.orders;
create policy orders_tenant on public.orders for all
  using (public.is_admin() or restaurant_id = public.me_org())
  with check (public.is_admin() or restaurant_id = public.me_org());

drop policy if exists campaigns_tenant on public.campaigns;
create policy campaigns_tenant on public.campaigns for all
  using (public.is_admin() or restaurant_id = public.me_org())
  with check (public.is_admin() or restaurant_id = public.me_org());

drop policy if exists devices_tenant on public.devices;
create policy devices_tenant on public.devices for all
  using (public.is_admin() or restaurant_id = public.me_org())
  with check (public.is_admin() or restaurant_id = public.me_org());
