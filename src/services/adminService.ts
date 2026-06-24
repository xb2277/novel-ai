import { supabase } from './supabase'
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

async function quickSyncLocalNovels(userId: string) {
  const novels = useStore.getState().novels
  const now = new Date().toISOString()
  for (const n of novels) {
    // 只同步小说基本信息（章节和大纲稍后由 persistNovel 处理）
    await supabase.from('novels').upsert({
      id: n.id, user_id: userId, title: n.title,
      intro: n.intro, current_chapter_id: n.currentChapterId,
      updated_at: now,
    }, { onConflict: 'id' }).then(({ error }) => {
      if (error) console.warn('quick sync novel upsert:', error.message)
    })
    // 同步章节
    if (n.chapters.length > 0) {
      const rows = n.chapters.map((c, i) => ({
        id: c.id, novel_id: n.id, title: c.title,
        content: c.content, word_count: c.wordCount, sort_order: i,
        updated_at: now,
      }))
      await supabase.from('chapters').upsert(rows, { onConflict: 'id' }).then(({ error }) => {
        if (error) console.warn('quick sync chapters upsert:', error.message)
      })
    }
  }
}

export async function fetchUserNovels(userId: string) {
  // 如果查的是当前用户，先同步本地数据到云端
  const me = useAuthStore.getState().user
  if (me && me.id === userId) {
    try {
      await quickSyncLocalNovels(userId)
    } catch (e) {
      console.warn('quick sync failed:', e)
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
