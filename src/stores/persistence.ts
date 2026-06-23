import type { Settings, OutlineNode, Chapter, Conversation } from './types'

// ===== Persistence =====

const SAVE_KEY = 'novel-ai-project'
const SETTINGS_KEY = 'novel-ai-settings'

export function loadProject(): {
  novelTitle: string
  novelIntro: string
  outlines: OutlineNode[]
  chapters: Chapter[]
  currentChapterId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveProject(state: {
  novelTitle: string
  novelIntro: string
  outlines: OutlineNode[]
  chapters: Chapter[]
  currentChapterId: string | null
  conversations: Conversation[]
  activeConversationId: string | null
}) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      novelTitle: state.novelTitle,
      novelIntro: state.novelIntro,
      outlines: state.outlines,
      chapters: state.chapters,
      currentChapterId: state.currentChapterId,
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
    }))
  } catch { /* quota exceeded */ }
}

export function loadSettings(): Settings {
  const defaults: Settings = {
    apiBaseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    bgColor: '#FFFFFF',
  }
  try {
    const saved = localStorage.getItem(SETTINGS_KEY)
    if (saved) return { ...defaults, ...JSON.parse(saved) }
  } catch { /* ignore */ }
  return defaults
}

export function saveSettings(settings: Settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}
