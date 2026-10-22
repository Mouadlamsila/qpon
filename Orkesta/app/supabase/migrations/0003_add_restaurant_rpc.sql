-- 0003 — Onboarding restaurant sans Edge Function.
-- RPC admin-only : crée organization + auth user (bcrypt) + identity + profile.
-- Même forme que scripts/create-restaurant-user.mjs (validé sur ce projet).
-- Sécurité : security definer + search_path fixe + is_admin() + execute authenticated only.

create or replace function public.admin_create_restaurant(
  p_name text,
  p_email text,
  p_password text
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org uuid;
  v_uid uuid;
  v_email text := lower(trim(p_email));
begin
  if not public.is_admin() then
    raise exception 'Admin requis';
  end if;
  if length(trim(p_name)) < 2 then
    raise exception 'Nom invalide';
  end if;
  if v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Email invalide';
  end if;
  if length(p_password) < 8 then
    raise exception 'Mot de passe : 8 caractères minimum';
  end if;

  insert into public.organizations (name)
  values (trim(p_name))
  returning id into v_org;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous
  ) values (
    '00000000-0000-0000-0000-000000000000', gen_random_uuid(),
    'authenticated', 'authenticated', v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(), now(), now(),
    '', '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"email_verified":true}'::jsonb,
    false, false
  )
  returning id into v_uid;

  insert into auth.identities (
    provider_id, user_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    v_uid, v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now(), now()
  );

  insert into public.profiles (id, email, role, organization_id)
  values (v_uid, v_email, 'server_restaurant', v_org);

  return v_org;
exception
  when unique_violation then
    raise exception 'Email déjà utilisé';
end;
$$;

revoke all on function public.admin_create_restaurant(text, text, text) from public;
revoke all on function public.admin_create_restaurant(text, text, text) from anon;
grant execute on function public.admin_create_restaurant(text, text, text) to authenticated;

notify pgrst, 'reload schema';
