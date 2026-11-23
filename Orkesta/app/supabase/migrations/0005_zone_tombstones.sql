-- 0005 — Tombstones de zones.
--
-- Problème réel observé : une tablette qui garde une zone en cache la repousse
-- au serveur (pushReference) avant de pull, ce qui ressuscite une zone supprimée
-- côté serveur. Une tombstone bloque l'INSERT pour toujours, même depuis un
-- ancien client ; le pull suivant nettoie le cache local.
--
-- Aucune policy RLS : table interne, jamais exposée aux clients.
-- Une suppression de zone devra insérer la tombstone AVANT le DELETE.

create table if not exists public.zone_tombstones (
  id uuid primary key,
  restaurant_id uuid not null references public.organizations(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

alter table public.zone_tombstones enable row level security;

create or replace function public.skip_deleted_zone() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.zone_tombstones t where t.id = new.id) then
    return null; -- INSERT silencieusement ignoré (comme ON CONFLICT DO NOTHING)
  end if;
  return new;
end;
$$;

drop trigger if exists zones_skip_deleted on public.zones;
create trigger zones_skip_deleted
  before insert on public.zones
  for each row execute function public.skip_deleted_zone();

notify pgrst, 'reload schema';
