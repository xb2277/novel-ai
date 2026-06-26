import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { getNextChapterTitle } from '../services/chapterNumber'
import type { AppState, Chapter, ChatMessage, Conversation, Novel, OutlineNode, Settings, Suggestion } from './types'
import { countChinese } from './types'
import { loadProject, saveProject, loadSettings, saveSettings, type SavedProject } from './persistence'
import { addToParent, findAndRemove, findAndToggle, findAndUpdate } from './outlineHelpers'
import { createDefaultNovel, createDefaultProject } from './defaults'
import { useAuthStore } from './authStore'
import { pullNovels, pushNovel, deleteNovelRemote, pushSettings, pullSettings } from '../services/syncService'

// Re-export types and helpers for consumers
export type { AppState, Chapter, ChatMessage, Conversation, Novel, OutlineNode, Settings, Suggestion, SavedProject }
export { countChinese, BG_COLOR_PRESETS } from './types'
export { loadProject, saveProject, loadSettings, saveSettings } from './persistence'
export { findInTree, addToParent, findAndUpdate, findAndRemove, findAndToggle } from './outlineHelpers'
export { createDefaultChapter, createDefaultNovel, createDefaultOutlines } from './defaults'

// ===== Persist helper =====

/** Inject current flat fields into novels array and write to localStorage. */
function persistNovel(get: () => AppState) {
  const s = get()
  const now = new Date().toISOString()
  const novels = s.novels.map((n) => {
    if (n.id !== s.currentNovelId) return n
    return {
      ...n,
      title: s.novelTitle,
      intro: s.novelIntro,
      outlines: s.outlines,
      chapters: s.chapters,
      currentChapterId: s.currentChapterId,
      conversations: s.conversations,
      activeConversationId: s.activeConversationId,
      updatedAt: now,
    }
  })
  saveProject({ novels, currentNovelId: s.currentNovelId })
  scheduleCloudSync()
}

/** Build flat fields from a Novel object. */
function loadNovelIntoFlat(novel: Novel) {
  return {
    novelTitle: novel.title,
    novelIntro: novel.intro,
    outlines: novel.outlines,
    chapters: novel.chapters,
    currentChapterId: novel.currentChapterId,
    conversations: novel.conversations,
    activeConversationId: novel.activeConversationId,
  }
}

// ===== Initialization =====

const saved = loadProject()
const initial = saved || createDefaultProject()
const firstNovel = initial.novels.find((n) => n.id === initial.currentNovelId) || initial.novels[0]
const flatFromNovel = firstNovel
  ? loadNovelIntoFlat(firstNovel)
  : loadNovelIntoFlat(createDefaultNovel())

// ===== Store =====

export const useStore = create<AppState>((set, get) => ({
  // Flat current-novel fields (mirrored from novels[currentNovelId])
  ...flatFromNovel,

  // Selection
  selectedText: '',
  suggestions: [],
  isLoading: false,
  settings: loadSettings(),

  // UI state
  sidePanelOpen: false,
  leftPanelOpen: true,
  referenceOpen: false,
  selectedOutlineNodeId: null,
  autoObserve: false,

  // Multi-novel
  novels: initial.novels.length > 0 ? initial.novels : [createDefaultNovel()],
  currentNovelId: initial.currentNovelId ?? initial.novels[0]?.id ?? null,

  // ===== Novel management =====

  createNovel: (title = '未命名作品') => {
    const novel = createDefaultNovel(title)
    set((state) => {
      const novels = [...state.novels, novel]
      saveProject({ novels, currentNovelId: novel.id })
      return { novels, currentNovelId: novel.id, ...loadNovelIntoFlat(novel) }
    })
    scheduleCloudSync()
    return novel
  },

  deleteNovel: (id) => {
    // Fire-and-forget remote delete if logged in
    if (useAuthStore.getState().user) {
      deleteNovelRemote(id).catch(() => {})
    }
    return set((state) => {
      const novels = state.novels.filter((n) => n.id !== id)
      let currentNovelId = state.currentNovelId

      if (state.currentNovelId === id) {
        const targetNovel = novels[novels.length - 1]
        currentNovelId = targetNovel?.id ?? null
        if (targetNovel) {
          saveProject({ novels, currentNovelId })
          return { novels, currentNovelId, ...loadNovelIntoFlat(targetNovel) }
        }
        saveProject({ novels, currentNovelId: null })
        return { novels, currentNovelId: null }
      }

      saveProject({ novels, currentNovelId })
      return { novels }
    })
  },

  switchToNovel: (id) => {
    persistNovel(get)
    const novel = get().novels.find((n) => n.id === id)
    if (!novel) return
    set({
      currentNovelId: id,
      ...loadNovelIntoFlat(novel),
    })
    saveProject({ novels: get().novels, currentNovelId: id })
  },

  renameNovel: (id, title) =>
    set((state) => {
      const novels = state.novels.map((n) =>
        n.id === id ? { ...n, title, updatedAt: new Date().toISOString() } : n
      )
      saveProject({ novels, currentNovelId: state.currentNovelId })
      if (id === state.currentNovelId) {
        return { novels, novelTitle: title }
      }
      return { novels }
    }),

  // ===== Per-novel actions =====

  setSelectedText: (text) => set({ selectedText: text }),
  setSuggestions: (suggestions) => set({ suggestions }),
  clearSuggestions: () => set({ suggestions: [], selectedText: '' }),
  setLoading: (loading) => set({ isLoading: loading }),

  setSettings: (partial) => {
    const updated = { ...get().settings, ...partial }
    saveSettings(updated)
    set({ settings: updated })
    // 双写云端
    pushSettings(updated)
  },

  toggleSidePanel: () => set((s) => ({ sidePanelOpen: !s.sidePanelOpen })),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleReference: () => set((s) => ({ referenceOpen: !s.referenceOpen })),
  setReferenceOpen: (open) => set({ referenceOpen: open }),
  setSelectedOutlineNodeId: (id) => set({ selectedOutlineNodeId: id }),
  setAutoObserve: (on) => set({ autoObserve: on }),

  setNovelTitle: (title) => {
    set((state) => ({
      novelTitle: title,
      novels: state.novels.map((n) =>
        n.id === state.currentNovelId ? { ...n, title, updatedAt: new Date().toISOString() } : n
      ),
    }))
    persistNovel(get)
  },
  setNovelIntro: (intro) => {
    set((state) => ({
      novelIntro: intro,
      novels: state.novels.map((n) =>
        n.id === state.currentNovelId ? { ...n, intro, updatedAt: new Date().toISOString() } : n
      ),
    }))
    persistNovel(get)
  },
  setOutlines: (outlines) => {
    set({ outlines })
    persistNovel(get)
  },

  addOutlineNode: (parentId, node) => {
    set((state) => ({ outlines: addToParent(state.outlines, parentId, node) }))
    persistNovel(get)
  },

  updateOutlineNode: (id, updates) => {
    set((state) => ({ outlines: findAndUpdate(state.outlines, id, updates) }))
    persistNovel(get)
  },

  removeOutlineNode: (id) => {
    set((state) => ({ outlines: findAndRemove(state.outlines, id) }))
    persistNovel(get)
  },

  toggleOutlineNode: (id) => {
    set((state) => ({ outlines: findAndToggle(state.outlines, id) }))
    persistNovel(get)
  },

  addChapter: (partial) => {
    let chapter: Chapter | null = null
    set((state) => {
      const now = new Date().toISOString()
      chapter = {
        id: uuidv4(),
        title: getNextChapterTitle(state.chapters),
        content: '',
        wordCount: 0,
        createdAt: now,
        updatedAt: now,
        ...partial,
      }
      const chapters = [...state.chapters, chapter]
      return { chapters, currentChapterId: chapter.id }
    })
    persistNovel(get)
    return chapter!
  },

  updateChapter: (id, updates) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id ? { ...ch, ...updates, updatedAt: new Date().toISOString() } : ch
      ),
    }))
    persistNovel(get)
  },

  removeChapter: (id) => {
    set((state) => {
      const chapters = state.chapters.filter((ch) => ch.id !== id)
      const currentChapterId =
        state.currentChapterId === id
          ? chapters[chapters.length - 1]?.id || null
          : state.currentChapterId
      return { chapters, currentChapterId }
    })
    persistNovel(get)
  },

  setCurrentChapter: (id) => {
    set({ currentChapterId: id })
    persistNovel(get)
  },

  getCurrentChapter: () => {
    const { chapters, currentChapterId } = get()
    return chapters.find((ch) => ch.id === currentChapterId)
  },

  recalcChapterWordCount: (id) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id ? { ...ch, wordCount: countChinese(ch.content) } : ch
      ),
    }))
    persistNovel(get)
  },

  saveChapterContent: (id, content) => {
    set((state) => ({
      chapters: state.chapters.map((ch) =>
        ch.id === id
          ? { ...ch, content, wordCount: countChinese(content), updatedAt: new Date().toISOString() }
          : ch
      ),
    }))
    persistNovel(get)
  },

  // ===== Conversation actions =====

  createConversation: (title = '新对话') => {
    const conv: Conversation = {
      id: uuidv4(),
      title,
      messages: [],
      createdAt: new Date().toISOString(),
    }
    set((state) => {
      const conversations = [...state.conversations, conv]
      return { conversations, activeConversationId: conv.id }
    })
    persistNovel(get)
    return conv
  },

  deleteConversation: (id) => {
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id)
      const activeConversationId =
        state.activeConversationId === id
          ? conversations[conversations.length - 1]?.id ?? null
          : state.activeConversationId
      return { conversations, activeConversationId }
    })
    persistNovel(get)
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id })
    persistNovel(get)
  },

  addMessage: (conversationId, message) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c
      ),
    }))
    persistNovel(get)
  },

  updateConversationTitle: (id, title) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      ),
    }))
    persistNovel(get)
  },
}))

// ===== Cloud sync integration =====

// Immediate push (no debounce) — for page unload or explicit sync
async function pushCurrentNow() {
  if (!useAuthStore.getState().user) return
  const s = useStore.getState()
  // Push ALL local novels, not just current
  const now = new Date().toISOString()
  for (const n of s.novels) {
    const snap = {
      ...n,
      updatedAt: now,
    }
    pushNovel(snap).catch((e) => console.warn('push sync:', e))
  }
}

// Debounced cloud sync (for frequent edits)
let cloudSyncTimer: ReturnType<typeof setTimeout>
function scheduleCloudSync() {
  if (!useAuthStore.getState().user) return
  clearTimeout(cloudSyncTimer)
  cloudSyncTimer = setTimeout(() => pushCurrentNow(), 2000)
}

// Push on page close
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => pushCurrentNow())
}

// Pull from cloud — called on login
async function pullAndMerge() {
  console.log('sync: pulling from cloud...')
  try {
    // 拉取云端设置（覆盖本地）
    const cloudSettings = await pullSettings()
    if (cloudSettings) {
      saveSettings(cloudSettings)
      useStore.setState({ settings: cloudSettings })
      console.log('sync: settings loaded from cloud')
    }

    const cloudNovels = await pullNovels()
    console.log('sync: pulled', cloudNovels.length, 'novels')
    const localNovels = useStore.getState().novels

    if (cloudNovels.length === 0 && localNovels.length > 0) {
      // Cloud is empty, push local
      console.log('sync: cloud empty, pushing local...')
      for (const n of localNovels) {
        await pushNovel(n).catch((e) => console.warn('sync: push local failed', e))
      }
      return
    }

    // Merge: cloud wins, preserve local conversations
    const merged = cloudNovels.map((cn) => {
      const local = localNovels.find((ln) => ln.id === cn.id)
      if (local) {
        cn.conversations = local.conversations
        cn.activeConversationId = local.activeConversationId
      }
      return cn
    })
    useStore.setState({
      novels: merged,
      currentNovelId: merged[0]?.id ?? null,
      ...(merged[0] ? {
        novelTitle: merged[0].title,
        novelIntro: merged[0].intro,
        outlines: merged[0].outlines,
        chapters: merged[0].chapters,
        currentChapterId: merged[0].currentChapterId,
        conversations: merged[0].conversations,
        activeConversationId: merged[0].activeConversationId,
      } : {}),
    })
    console.log('sync: merged', merged.length, 'novels')
  } catch (e) {
    console.error('sync: pull failed', e)
  }
}

// Auth state listener
let lastUserId: string | null = null
useAuthStore.subscribe((state) => {
  const currentId = state.user?.id ?? null

  if (currentId && currentId !== lastUserId) {
    lastUserId = currentId
    pullAndMerge()
  }

  if (!currentId) {
    lastUserId = null
  }
})
