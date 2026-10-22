// Capture REAL PostgREST error body (PowerShell was hiding it).
const env = Object.fromEntries(
  (await import('node:fs')).readFileSync('.env', 'utf8').split(/\r?\n/).filter((l) => l.includes('='))
    .map((l) => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim()] }),
)
const url = env.VITE_SUPABASE_URL
const anon = env.VITE_SUPABASE_ANON_KEY

for (const t of ['organizations', 'zones', 'orders']) {
  const res = await fetch(`${url}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: anon, Authorization: `Bearer ${anon}` },
  })
  const text = await res.text()
  console.log(`--- ${t} ---`)
  console.log(`status: ${res.status}`)
  console.log(`headers content-type: ${res.headers.get('content-type')}`)
  console.log(`body: "${text}"`)
}

// Also hit OpenAPI with proper capture
console.log('--- OpenAPI root ---')
const r2 = await fetch(`${url}/rest/v1/`, { headers: { apikey: anon, Authorization: `Bearer ${anon}` } })
console.log(`status: ${r2.status} body: "${await r2.text()}"`)
