-- 0002 — Durcissement RLS (0001 laissait `for all` : la tablette pouvait
-- UPDATE/DELETE ses rows, et `profiles_update_self` permettait de devenir admin).
--
-- Modèle :
--   restaurant : SELECT + INSERT (orders/zones/promos), jamais UPDATE/DELETE
--   admin      : tout
--   profiles   : lecture self/admin, écriture admin only (anti-escalade)

-- ========== profiles ==========
drop policy if exists profiles_self on public.profiles;
drop policy if exists profiles_update_self on public.profiles;
drop policy if exists profiles_read on public.profiles;
drop policy if exists profiles_admin_update on public.profiles;

create policy profiles_read on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Un utilisateur ne peut PAS changer son rôle / organisation.
create policy profiles_admin_update on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- ========== organizations ==========
drop policy if exists orgs_read on public.organizations;
create policy orgs_read on public.organizations for select
  using (public.is_admin() or id = public.me_org());

-- ========== zones ==========
drop policy if exists zones_tenant on public.zones;
drop policy if exists zones_read on public.zones;
drop policy if exists zones_insert on public.zones;
drop policy if exists zones_admin_update on public.zones;
drop policy if exists zones_admin_delete on public.zones;

create policy zones_read on public.zones for select
  using (public.is_admin() or restaurant_id = public.me_org());
create policy zones_insert on public.zones for insert
  with check (public.is_admin() or restaurant_id = public.me_org());
create policy zones_admin_update on public.zones for update
  using (public.is_admin()) with check (public.is_admin());
create policy zones_admin_delete on public.zones for delete
  using (public.is_admin());

-- ========== promos ==========
drop policy if exists promos_tenant on public.promos;
drop policy if exists promos_read on public.promos;
drop policy if exists promos_insert on public.promos;
drop policy if exists promos_admin_update on public.promos;
drop policy if exists promos_admin_delete on public.promos;

create policy promos_read on public.promos for select
  using (public.is_admin() or restaurant_id = public.me_org());
create policy promos_insert on public.promos for insert
  with check (public.is_admin() or restaurant_id = public.me_org());
create policy promos_admin_update on public.promos for update
  using (public.is_admin()) with check (public.is_admin());
create policy promos_admin_delete on public.promos for delete
  using (public.is_admin());

-- ========== orders ==========
drop policy if exists orders_tenant on public.orders;
drop policy if exists orders_read on public.orders;
drop policy if exists orders_insert on public.orders;
drop policy if exists orders_admin_update on public.orders;
drop policy if exists orders_admin_delete on public.orders;

create policy orders_read on public.orders for select
  using (public.is_admin() or restaurant_id = public.me_org());

-- Une commande ne peut référencer QUE les zones/promos du même restaurant.
create policy orders_insert on public.orders for insert with check (
  public.is_admin() or (
    restaurant_id = public.me_org()
    and exists (select 1 from public.zones z
                where z.id = zone_id and z.restaurant_id = public.me_org())
    and exists (select 1 from public.promos p
                where p.id = promo_id and p.restaurant_id = public.me_org())
  )
);

create policy orders_admin_update on public.orders for update
  using (public.is_admin()) with check (public.is_admin());
create policy orders_admin_delete on public.orders for delete
  using (public.is_admin());

-- ========== campaigns ==========
drop policy if exists campaigns_tenant on public.campaigns;
drop policy if exists campaigns_read on public.campaigns;
drop policy if exists campaigns_insert on public.campaigns;
drop policy if exists campaigns_admin_update on public.campaigns;
drop policy if exists campaigns_admin_delete on public.campaigns;

create policy campaigns_read on public.campaigns for select
  using (public.is_admin() or restaurant_id = public.me_org());
create policy campaigns_insert on public.campaigns for insert
  with check (public.is_admin() or restaurant_id = public.me_org());
create policy campaigns_admin_update on public.campaigns for update
  using (public.is_admin()) with check (public.is_admin());
create policy campaigns_admin_delete on public.campaigns for delete
  using (public.is_admin());

-- ========== devices ==========
drop policy if exists devices_tenant on public.devices;
drop policy if exists devices_read on public.devices;
drop policy if exists devices_admin_insert on public.devices;
drop policy if exists devices_admin_update on public.devices;
drop policy if exists devices_admin_delete on public.devices;

create policy devices_read on public.devices for select
  using (public.is_admin() or restaurant_id = public.me_org());
create policy devices_admin_insert on public.devices for insert
  with check (public.is_admin());
create policy devices_admin_update on public.devices for update
  using (public.is_admin()) with check (public.is_admin());
create policy devices_admin_delete on public.devices for delete
  using (public.is_admin());
