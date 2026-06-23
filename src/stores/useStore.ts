import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import { getNextChapterTitle } from '../services/chapterNumber'
import type { AppState, Chapter, ChatMessage, Conversation, OutlineNode, Settings, Suggestion } from './types'
import { countChinese } from './types'
import { loadProject, saveProject, loadSettings, saveSettings } from './persistence'
import { addToParent, findAndRemove, findAndToggle, findAndUpdate } from './outlineHelpers'
import { createDefaultProject } from './defaults'

// Re-export types and helpers for consumers
export type { AppState, Chapter, ChatMessage, Conversation, OutlineNode, Settings, Suggestion }
export { countChinese, BG_COLOR_PRESETS } from './types'
export { loadProject, saveProject, loadSettings, saveSettings } from './persistence'
export { findInTree, addToParent, findAndUpdate, findAndRemove, findAndToggle } from './outlineHelpers'
export { createDefaultChapter, createDefaultProject, createDefaultConversation, createDefaultOutlines } from './defaults'

// ===== Store =====

const saved = loadProject()
const initial = saved || createDefaultProject()

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  selectedText: '',
  suggestions: [],
  isLoading: false,
  settings: loadSettings(),
  sidePanelOpen: false,
  leftPanelOpen: true,
  referenceOpen: false,
  selectedOutlineNodeId: null,
  autoObserve: false,

  novelTitle: initial.novelTitle,
  novelIntro: initial.novelIntro,
  outlines: initial.outlines,
  chapters: initial.chapters,
  currentChapterId: initial.currentChapterId,

  conversations: initial.conversations ?? [],
  activeConversationId: initial.activeConversationId ?? null,

  // Actions
  setSelectedText: (text) => set({ selectedText: text }),
  setSuggestions: (suggestions) => set({ suggestions }),
  clearSuggestions: () => set({ suggestions: [], selectedText: '' }),
  setLoading: (loading) => set({ isLoading: loading }),

  setSettings: (partial) => {
    const updated = { ...get().settings, ...partial }
    saveSettings(updated)
    set({ settings: updated })
  },

  toggleSidePanel: () => set((state) => ({ sidePanelOpen: !state.sidePanelOpen })),
  setSidePanelOpen: (open) => set({ sidePanelOpen: open }),
  toggleLeftPanel: () => set((state) => ({ leftPanelOpen: !state.leftPanelOpen })),
  toggleReference: () => set((state) => ({ referenceOpen: !state.referenceOpen })),
  setReferenceOpen: (open) => set({ referenceOpen: open }),
  setSelectedOutlineNodeId: (id) => set({ selectedOutlineNodeId: id }),
  setAutoObserve: (on) => set({ autoObserve: on }),

  setNovelTitle: (title) => {
    set({ novelTitle: title })
    saveProject({ ...get(), novelTitle: title })
  },

  setNovelIntro: (intro) => {
    set({ novelIntro: intro })
    saveProject({ ...get(), novelIntro: intro })
  },

  setOutlines: (outlines) => {
    set({ outlines })
    saveProject({ ...get(), outlines })
  },

  addOutlineNode: (parentId, node) =>
    set((state) => {
      const outlines = addToParent(state.outlines, parentId, node)
      saveProject({ ...state, outlines })
      return { outlines }
    }),

  updateOutlineNode: (id, updates) =>
    set((state) => {
      const outlines = findAndUpdate(state.outlines, id, updates)
      saveProject({ ...state, outlines })
      return { outlines }
    }),

  removeOutlineNode: (id) =>
    set((state) => {
      const outlines = findAndRemove(state.outlines, id)
      saveProject({ ...state, outlines })
      return { outlines }
    }),

  toggleOutlineNode: (id) =>
    set((state) => {
      const outlines = findAndToggle(state.outlines, id)
      saveProject({ ...state, outlines })
      return { outlines }
    }),

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
      const newState = { chapters, currentChapterId: chapter.id }
      saveProject({ ...state, ...newState })
      return newState
    })
    return chapter!
  },

  updateChapter: (id, updates) =>
    set((state) => {
      const chapters = state.chapters.map((ch) =>
        ch.id === id ? { ...ch, ...updates, updatedAt: new Date().toISOString() } : ch
      )
      saveProject({ ...state, chapters })
      return { chapters }
    }),

  removeChapter: (id) =>
    set((state) => {
      const chapters = state.chapters.filter((ch) => ch.id !== id)
      const currentChapterId =
        state.currentChapterId === id
          ? chapters[chapters.length - 1]?.id || null
          : state.currentChapterId
      const newState = { chapters, currentChapterId }
      saveProject({ ...state, ...newState })
      return newState
    }),

  setCurrentChapter: (id) => {
    set({ currentChapterId: id })
    saveProject({ ...get(), currentChapterId: id })
  },

  getCurrentChapter: () => {
    const { chapters, currentChapterId } = get()
    return chapters.find((ch) => ch.id === currentChapterId)
  },

  recalcChapterWordCount: (id) =>
    set((state) => {
      const chapters = state.chapters.map((ch) =>
        ch.id === id ? { ...ch, wordCount: countChinese(ch.content) } : ch
      )
      saveProject({ ...state, chapters })
      return { chapters }
    }),

  /** Atomic save: update content + recalc word count in one operation */
  saveChapterContent: (id, content) =>
    set((state) => {
      const chapters = state.chapters.map((ch) =>
        ch.id === id
          ? { ...ch, content, wordCount: countChinese(content), updatedAt: new Date().toISOString() }
          : ch
      )
      saveProject({ ...state, chapters })
      return { chapters }
    }),

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
      saveProject({ ...state, conversations, activeConversationId: conv.id })
      return { conversations, activeConversationId: conv.id }
    })
    return conv
  },

  deleteConversation: (id) =>
    set((state) => {
      const conversations = state.conversations.filter((c) => c.id !== id)
      const activeConversationId =
        state.activeConversationId === id
          ? conversations[conversations.length - 1]?.id ?? null
          : state.activeConversationId
      saveProject({ ...state, conversations, activeConversationId })
      return { conversations, activeConversationId }
    }),

  setActiveConversation: (id) => {
    set({ activeConversationId: id })
    saveProject({ ...get(), activeConversationId: id })
  },

  addMessage: (conversationId, message) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message] }
          : c
      )
      saveProject({ ...state, conversations })
      return { conversations }
    }),

  updateConversationTitle: (id, title) =>
    set((state) => {
      const conversations = state.conversations.map((c) =>
        c.id === id ? { ...c, title } : c
      )
      saveProject({ ...state, conversations })
      return { conversations }
    }),
}))
