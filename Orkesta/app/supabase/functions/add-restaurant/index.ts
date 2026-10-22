// Edge Function — onboarding restaurant (admin only).
// Crée organization + compte Auth (email confirmé) + profil server_restaurant.
// Déploiement : supabase functions deploy add-restaurant
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST requis' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const anon = Deno.env.get('SUPABASE_ANON_KEY')
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anon || !service) return json({ error: 'Secrets Supabase manquants' }, 500)

  // 1) Vérifier l'appelant avec SON jwt (pas le service role).
  const asUser = createClient(url, anon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
    auth: { persistSession: false },
  })
  const { data: { user } } = await asUser.auth.getUser()
  if (!user) return json({ error: 'Non authentifié' }, 401)

  const admin = createClient(url, service, { auth: { persistSession: false } })
  const { data: prof } = await admin.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin_foued') return json({ error: 'Admin requis' }, 403)

  // 2) Valider l'input.
  let body: { name?: string; email?: string; password?: string }
  try { body = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }
  const name = String(body.name ?? '').trim()
  const email = String(body.email ?? '').trim().toLowerCase()
  const password = String(body.password ?? '')
  if (name.length < 2 || !email.includes('@') || password.length < 8) {
    return json({ error: 'Champs invalides (nom, email, mot de passe ≥ 8)' }, 400)
  }

  // 3) Org → compte Auth → profil. Rollback si une étape échoue.
  const { data: org, error: orgErr } = await admin.from('organizations').insert({ name }).select('id').single()
  if (orgErr || !org) return json({ error: orgErr?.message ?? 'Org non créée' }, 400)

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (userErr || !created.user) {
    await admin.from('organizations').delete().eq('id', org.id)
    return json({ error: userErr?.message ?? 'Compte non créé' }, 400)
  }

  const { error: profErr } = await admin.from('profiles').insert({
    id: created.user.id, email, role: 'server_restaurant', organization_id: org.id,
  })
  if (profErr) {
    await admin.auth.admin.deleteUser(created.user.id)
    await admin.from('organizations').delete().eq('id', org.id)
    return json({ error: profErr.message }, 400)
  }

  return json({ ok: true, orgId: org.id, userId: created.user.id })
})
