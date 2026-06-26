import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import type { Novel, Chapter, OutlineNode, Settings } from '../stores/types'

// ===== Pull: 拉取所有用户小说 =====

export async function pullNovels(): Promise<Novel[]> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return []

  const { data: novels, error } = await supabase
    .from('novels')
    .select('*, chapters:chapters!novel_id(*), outline_nodes:outline_nodes!novel_id(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!novels) return []

  return novels.map((n: any) => {
    const chapters: Chapter[] = (n.chapters || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((c: any) => ({
        id: c.id,
        title: c.title,
        content: c.content,
        wordCount: c.word_count,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }))

    const outlines = buildOutlineTree(n.outline_nodes || [])

    return {
      id: n.id,
      title: n.title,
      intro: n.intro || '',
      outlines,
      chapters,
      currentChapterId: n.current_chapter_id,
      conversations: [],
      activeConversationId: null,
      createdAt: n.created_at,
      updatedAt: n.updated_at,
    }
  })
}

function buildOutlineTree(nodes: any[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>()
  const roots: OutlineNode[] = []

  for (const n of nodes) {
    map.set(n.id, {
      id: n.id, title: n.title, content: n.content || '',
      expanded: n.expanded, children: [],
    })
  }
  for (const n of nodes) {
    const node = map.get(n.id)!
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(node)
    } else if (!n.parent_id) {
      roots.push(node)
    }
  }
  return roots.sort((a, b) => {
    const na = nodes.find((n: any) => n.id === a.id)
    const nb = nodes.find((n: any) => n.id === b.id)
    return (na?.sort_order ?? 0) - (nb?.sort_order ?? 0)
  })
}

// ===== Push: 上传一本小说 =====

export async function pushNovel(novel: Novel): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return

  const { error: novelErr } = await supabase.from('novels').upsert({
    id: novel.id,
    user_id: userId,
    title: novel.title,
    intro: novel.intro,
    current_chapter_id: novel.currentChapterId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (novelErr) throw new Error(novelErr.message)

  // Push chapters
  const chapterRows = novel.chapters.map((c, i) => ({
    id: c.id,
    novel_id: novel.id,
    title: c.title,
    content: c.content,
    word_count: c.wordCount,
    sort_order: i,
    updated_at: new Date().toISOString(),
  }))
  if (chapterRows.length > 0) {
    const { error: chErr } = await supabase.from('chapters').upsert(chapterRows, { onConflict: 'id' })
    if (chErr) throw new Error(chErr.message)
  }

  // Push outline nodes — upsert逐一保存，旧节点不删（数据安全第一）
  for (const row of flattenOutlines(novel.outlines, novel.id, null)) {
    const { error: outErr } = await supabase.from('outline_nodes').upsert(row, { onConflict: 'id' })
    if (outErr) console.warn('sync outline:', outErr.message)
  }
}

function flattenOutlines(
  nodes: OutlineNode[], novelId: string, parentId: string | null, startIdx = 0
): any[] {
  const rows: any[] = []
  nodes.forEach((n, i) => {
    rows.push({
      id: n.id, novel_id: novelId, parent_id: parentId,
      title: n.title, content: n.content,
      expanded: n.expanded, sort_order: startIdx + i,
    })
    if (n.children.length > 0) {
      rows.push(...flattenOutlines(n.children, novelId, n.id, 0))
    }
  })
  return rows
}

// ===== Delete remote novel =====

export async function deleteNovelRemote(id: string): Promise<void> {
  const { error } = await supabase.from('novels').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ===== Settings sync =====

export async function pullSettings(): Promise<Settings | null> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return null
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    apiBaseUrl: data.api_base_url,
    apiKey: data.api_key,
    model: data.model,
    bgColor: data.bg_color,
  }
}

export async function pushSettings(settings: Settings): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return
  await supabase.from('user_settings').upsert({
    user_id: userId,
    api_base_url: settings.apiBaseUrl,
    api_key: settings.apiKey,
    model: settings.model,
    bg_color: settings.bgColor,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' }).then(({ error }) => {
    if (error) console.warn('sync settings:', error.message)
  })
}
