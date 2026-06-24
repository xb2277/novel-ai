import { supabase } from './supabase'
import { pushNovel } from './syncService'
import { useStore } from '../stores/useStore'
import { useAuthStore } from '../stores/authStore'

export async function fetchAllUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function toggleUserDisabled(userId: string, disabled: boolean) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_disabled: disabled })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function fetchAllNovels() {
  const { data, error } = await supabase
    .from('novels')
    .select('*, profiles:user_id(username), chapters:chapters!novel_id(id)')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchUserNovels(userId: string) {
  // 如果查的是当前用户，先把本地未同步的小说推上去
  const me = useAuthStore.getState().user
  if (me && me.id === userId) {
    const localNovels = useStore.getState().novels
    for (const n of localNovels) {
      pushNovel(n).catch(() => {})
    }
  }

  const { data, error } = await supabase
    .from('novels')
    .select('*, chapters:chapters!novel_id(id, word_count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
