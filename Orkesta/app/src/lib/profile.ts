import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { UserRole } from './types'

export interface UserProfile {
  id: string
  email: string
  role: UserRole
  organizationId: string | null
  organizationName: string | null
  fullName: string
  phone: string
  jobTitle: string
  createdAt: string | null
}

export interface AuthSummary {
  id: string
  email: string
  fullName: string
}

function readMeta(meta: Record<string, unknown> | undefined) {
  return {
    fullName: typeof meta?.full_name === 'string' ? meta.full_name : '',
    phone: typeof meta?.phone === 'string' ? meta.phone : '',
    jobTitle: typeof meta?.job_title === 'string' ? meta.job_title : '',
  }
}

export async function fetchMyProfile(): Promise<UserProfile | null> {
  if (!supabase) return null
  const { data: userRes, error: userErr } = await supabase.auth.getUser()
  if (userErr) throw userErr
  const user = userRes.user
  if (!user) return null

  const { data: prof } = await supabase
    .from('profiles')
    .select('role, organization_id')
    .eq('id', user.id)
    .single()

  let organizationName: string | null = null
  if (prof?.organization_id) {
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', prof.organization_id)
      .single()
    organizationName = org?.name ?? null
  }

  const meta = readMeta(user.user_metadata)
  return {
    id: user.id,
    email: user.email ?? '',
    role: (prof?.role as UserRole) ?? 'server_restaurant',
    organizationId: prof?.organization_id ?? null,
    organizationName,
    fullName: meta.fullName,
    phone: meta.phone,
    jobTitle: meta.jobTitle,
    createdAt: user.created_at ?? null,
  }
}

export async function updateMyProfileInfo(input: {
  fullName: string
  phone: string
  jobTitle: string
  email?: string
}): Promise<{ emailPendingConfirmation: boolean }> {
  if (!supabase) throw new Error('Supabase non configuré')
  const { data: cur } = await supabase.auth.getUser()
  const currentEmail = cur.user?.email ?? ''
  const nextEmail = input.email?.trim()
  const emailChanged = Boolean(nextEmail && nextEmail !== currentEmail)

  const payload: {
    email?: string
    data: { full_name: string; phone: string; job_title: string }
  } = {
    data: {
      full_name: input.fullName.trim(),
      phone: input.phone.trim(),
      job_title: input.jobTitle.trim(),
    },
  }
  if (emailChanged && nextEmail) {
    payload.email = nextEmail
  }

  const { error } = await supabase.auth.updateUser(payload)
  if (error) throw error
  return { emailPendingConfirmation: emailChanged }
}

export async function updateMyPassword(newPassword: string): Promise<void> {
  if (!supabase) throw new Error('Supabase non configuré')
  if (newPassword.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères')
  }
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw error
}

export function useAuthUser(): AuthSummary | null {
  const [user, setUser] = useState<AuthSummary | null>(null)

  useEffect(() => {
    if (!supabase) return
    let alive = true
    const sync = async () => {
      const { data } = await supabase!.auth.getSession()
      if (!alive) return
      const u = data.session?.user
      if (!u) {
        setUser(null)
        return
      }
      const meta = readMeta(u.user_metadata)
      setUser({
        id: u.id,
        email: u.email ?? '',
        fullName: meta.fullName,
      })
    }
    void sync()
    const { data } = supabase.auth.onAuthStateChange(() => void sync())
    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  return user
}

