import { supabase } from './supabase'

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
    .select('*, profiles:user_id(username), chapters:chapters(id)')
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchUserNovels(userId: string) {
  const { data, error } = await supabase
    .from('novels')
    .select('*, chapters:chapters(id, word_count)')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
