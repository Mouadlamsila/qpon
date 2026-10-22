import { createClient } from '@supabase/supabase-js'

// Remplir .env.local avec les vraies clés Supabase.
// RLS = seule sécurité multi-tenant. PIN 2026 = UX seulement.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anon)

// Client optionnel : l'app tourne offline (Dexie) même sans Supabase.
export const supabase = isSupabaseConfigured
  ? createClient(url as string, anon as string)
  : null

// DEV uniquement — permet de vérifier session + RLS depuis la console.
if (import.meta.env.DEV && supabase && typeof window !== 'undefined') {
  ;(window as unknown as { __sb: typeof supabase }).__sb = supabase
}
