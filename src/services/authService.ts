import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'

export async function register(
  username: string, email: string, password: string
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('注册失败，请稍后重试')
}

export async function login(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('登录失败')
  await loadUserProfile(data.user)
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  useAuthStore.getState().clearUser()
}

async function loadUserProfile(user: User): Promise<void> {
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin, is_disabled')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('loadUserProfile error:', error.message, error.code)
  }

  // If profile doesn't exist yet (trigger race), create it now
  if (!data) {
    const username = user.user_metadata?.username || user.email?.split('@')[0] || '用户'
    const { error: insertErr } = await supabase
      .from('profiles')
      .insert({ id: user.id, username, is_admin: false })
    if (insertErr) {
      console.error('create profile error:', insertErr.message)
    }
    useAuthStore.getState().setUser(user, false)
    return
  }

  if (data.is_disabled) {
    await supabase.auth.signOut()
    throw new Error('账号已被禁用，请联系管理员')
  }

  useAuthStore.getState().setUser(user, data.is_admin ?? false)
}

export async function restoreSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    try {
      await loadUserProfile(session.user)
    } catch {
      useAuthStore.getState().clearUser()
    }
  }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    try { await loadUserProfile(session.user) } catch {
      useAuthStore.getState().clearUser()
    }
  }
  if (event === 'SIGNED_OUT') {
    useAuthStore.getState().clearUser()
  }
})
