-- 0004 — Coût campagne unique par jour + historique des distributions flyers.
--
-- Pourquoi :
--  - campaigns insert-only : deux clics = 2 x 250 € → ROI faux. Ici on garantit
--    UNE ligne par restaurant et par date (l'admin peut réenregistrer = upsert).
--  - zones.flyers_distributed est un cumul. Filtrer les commandes par période
--    tout en gardant le cumul au dénominateur donnait un taux trompeur.
--    On journalise chaque écart de total avec sa date, puis le dashboard somme
--    les distributions de la période.
--
-- Idempotent : scripts/migrate.mjs rejoue tous les fichiers.

-- ========== campaigns ==========
-- Doublons éventuels : garder la ligne la plus récente pour (restaurant, date).
delete from public.campaigns a
using public.campaigns b
where a.restaurant_id = b.restaurant_id
  and a.start_date = b.start_date
  and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists campaigns_restaurant_date_uidx
  on public.campaigns (restaurant_id, start_date);

-- ========== flyer_distributions ==========
create table if not exists public.flyer_distributions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  count integer not null check (count <> 0),
  distributed_on date not null default ((now() at time zone 'Europe/Brussels')::date),
  created_at timestamptz not null default now()
);

create index if not exists idx_flyer_dist_org_date
  on public.flyer_distributions (restaurant_id, distributed_on);
create index if not exists idx_flyer_dist_zone_date
  on public.flyer_distributions (zone_id, distributed_on);

alter table public.flyer_distributions enable row level security;

drop policy if exists flyer_dist_read on public.flyer_distributions;
drop policy if exists flyer_dist_admin_insert on public.flyer_distributions;
drop policy if exists flyer_dist_admin_update on public.flyer_distributions;
drop policy if exists flyer_dist_admin_delete on public.flyer_distributions;

create policy flyer_dist_read on public.flyer_distributions for select
  using (public.is_admin() or restaurant_id = public.me_org());
create policy flyer_dist_admin_insert on public.flyer_distributions for insert
  with check (public.is_admin());
create policy flyer_dist_admin_update on public.flyer_distributions for update
  using (public.is_admin()) with check (public.is_admin());
create policy flyer_dist_admin_delete on public.flyer_distributions for delete
  using (public.is_admin());

grant select on public.flyer_distributions to authenticated;

-- Baseline : le total actuel de chaque zone est daté de sa première commande
-- (fallback hier). But : « Tout » / semaine / mois gardent les chiffres actuels,
-- mais « Aujourd'hui » ne prétend pas que tout le cumul a été posé aujourd'hui.
insert into public.flyer_distributions (restaurant_id, zone_id, count, distributed_on)
select
  z.restaurant_id,
  z.id,
  z.flyers_distributed,
  coalesce(
    (select (min(o.created_at) at time zone 'Europe/Brussels')::date
     from public.orders o where o.zone_id = z.id),
    (now() at time zone 'Europe/Brussels')::date - 1
  )
from public.zones z
where z.flyers_distributed <> 0
  and not exists (
    select 1 from public.flyer_distributions d where d.zone_id = z.id
  );

-- ========== RPC : total zone + journal atomique ==========
-- Appelée par le dashboard. p_date = date de la distribution (défaut aujourd'hui).
create or replace function public.admin_set_zone_flyers(
  p_zone_id uuid,
  p_total integer,
  p_date date default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_zone public.zones%rowtype;
  v_delta integer;
  v_date date := coalesce(p_date, (now() at time zone 'Europe/Brussels')::date);
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;
  if p_total is null or p_total < 0 then
    raise exception 'Total flyers invalide';
  end if;
  if v_date > (now() at time zone 'Europe/Brussels')::date then
    raise exception 'Date future interdite';
  end if;

  select * into v_zone from public.zones where id = p_zone_id for update;
  if not found then
    raise exception 'Zone introuvable';
  end if;

  v_delta := p_total - v_zone.flyers_distributed;
  if v_delta <> 0 then
    insert into public.flyer_distributions (restaurant_id, zone_id, count, distributed_on)
    values (v_zone.restaurant_id, v_zone.id, v_delta, v_date);
    update public.zones set flyers_distributed = p_total where id = v_zone.id;
  end if;
end;
$$;

revoke all on function public.admin_set_zone_flyers(uuid, integer, date) from public;
revoke all on function public.admin_set_zone_flyers(uuid, integer, date) from anon;
grant execute on function public.admin_set_zone_flyers(uuid, integer, date) to authenticated;

notify pgrst, 'reload schema';
