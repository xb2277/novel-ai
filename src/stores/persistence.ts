import type { Settings, Novel } from './types'
import { createDefaultNovel } from './defaults'

// ===== Persistence =====

const SAVE_KEY = 'novel-ai-project'
const SETTINGS_KEY = 'novel-ai-settings'
const MIGRATED_KEY = 'novel-ai-migrated'

function isLegacyFormat(data: Record<string, unknown>): boolean {
  return typeof data.novelTitle === 'string' && !Array.isArray(data.novels)
}

/** Convert old flat-book format to multi-novel array */
function migrateLegacy(data: Record<string, unknown>): {
  novels: Novel[]
  currentNovelId: string
} {
  const novel = createDefaultNovel('未命名作品')
  novel.title = (data.novelTitle as string) || novel.title
  novel.intro = (data.novelIntro as string) || ''
  novel.outlines = (data.outlines as Novel['outlines']) || novel.outlines
  novel.chapters = (data.chapters as Novel['chapters']) || novel.chapters
  novel.currentChapterId = (data.currentChapterId as string) || novel.currentChapterId
  novel.conversations = (data.conversations as Novel['conversations']) || novel.conversations
  novel.activeConversationId = (data.activeConversationId as string) || novel.activeConversationId
  return { novels: [novel], currentNovelId: novel.id }
}

export interface SavedProject {
  novels: Novel[]
  currentNovelId: string | null
}

export function loadProject(): SavedProject | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)

    if (isLegacyFormat(data)) {
      const migrated = migrateLegacy(data)
      // Save migrated format back immediately
      localStorage.setItem(SAVE_KEY, JSON.stringify(migrated))
      localStorage.setItem(MIGRATED_KEY, 'true')
      return migrated
    }

    return data as SavedProject
  } catch {
    return null
  }
}

export function saveProject(state: SavedProject) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      novels: state.novels,
      currentNovelId: state.currentNovelId,
    }))
  } catch { /* quota exceeded */ }
}

const SETTINGS_BACKUP_KEY = 'novel-ai-settings-bak'

export function loadSettings(): Settings {
  const defaults: Settings = {
    apiBaseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    model: 'deepseek-chat',
    bgColor: '#FFFFFF',
  }
  try {
    // 优先读主键，缺失则用备份键恢复
    const saved = localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(SETTINGS_BACKUP_KEY)
    if (saved) {
      const parsed = { ...defaults, ...JSON.parse(saved) }
      // 恢复备份到主键
      if (!localStorage.getItem(SETTINGS_KEY) && localStorage.getItem(SETTINGS_BACKUP_KEY)) {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed))
      }
      return parsed
    }
  } catch { /* ignore */ }
  return defaults
}

export function saveSettings(settings: Settings) {
  const json = JSON.stringify(settings)
  localStorage.setItem(SETTINGS_KEY, json)
  localStorage.setItem(SETTINGS_BACKUP_KEY, json)
}
