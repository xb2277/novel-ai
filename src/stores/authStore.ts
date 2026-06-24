import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  isAdmin: boolean
  setUser: (user: User | null, isAdmin?: boolean) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAdmin: false,
  setUser: (user, isAdmin = false) => set({ user, isAdmin }),
  clearUser: () => set({ user: null, isAdmin: false }),
}))
