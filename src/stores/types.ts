// ===== Types =====

export interface Suggestion {
  id: string
  text: string
  label: string
}

export interface Settings {
  apiBaseUrl: string
  apiKey: string
  model: string
  bgColor: string
}

export const BG_COLOR_PRESETS = [
  { value: '#FFFFFF', label: '纯白' },
  { value: '#FAF9DE', label: '杏仁黄' },
  { value: '#C7EDCC', label: '绿豆沙' },
  { value: '#DCE2F1', label: '海天蓝' },
  { value: '#EAEAEF', label: '极光灰' },
]

export interface OutlineNode {
  id: string
  title: string
  content: string
  children: OutlineNode[]
  expanded: boolean
}

export interface Chapter {
  id: string
  title: string
  content: string
  wordCount: number
  createdAt: string
  updatedAt: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
}

export function countChinese(text: string): number {
  const html = text.replace(/<[^>]*>/g, '')
  const str = html.replace(/\s+/g, '')
  const chinese = str.match(/[一-鿿㐀-䶿]/g)
  return chinese ? chinese.length : 0
}

// ===== Store Interface =====

export interface AppState {
  // Selection
  selectedText: string
  suggestions: Suggestion[]
  isLoading: boolean
  settings: Settings

  // UI state
  sidePanelOpen: boolean
  leftPanelOpen: boolean
  referenceOpen: boolean
  selectedOutlineNodeId: string | null
  autoObserve: boolean

  // Project data
  novelTitle: string
  novelIntro: string
  outlines: OutlineNode[]
  chapters: Chapter[]
  currentChapterId: string | null

  // Conversation
  conversations: Conversation[]
  activeConversationId: string | null

  // Actions
  setSelectedText: (text: string) => void
  setSuggestions: (suggestions: Suggestion[]) => void
  clearSuggestions: () => void
  setLoading: (loading: boolean) => void
  setSettings: (settings: Partial<Settings>) => void

  toggleSidePanel: () => void
  setSidePanelOpen: (open: boolean) => void
  toggleLeftPanel: () => void
  toggleReference: () => void
  setReferenceOpen: (open: boolean) => void
  setSelectedOutlineNodeId: (id: string | null) => void
  setAutoObserve: (on: boolean) => void

  setNovelTitle: (title: string) => void
  setNovelIntro: (intro: string) => void
  setOutlines: (outlines: OutlineNode[]) => void
  addOutlineNode: (parentId: string | null, node: OutlineNode) => void
  updateOutlineNode: (id: string, updates: Partial<OutlineNode>) => void
  removeOutlineNode: (id: string) => void
  toggleOutlineNode: (id: string) => void

  addChapter: (chapter?: Partial<Chapter>) => Chapter
  updateChapter: (id: string, updates: Partial<Chapter>) => void
  removeChapter: (id: string) => void
  setCurrentChapter: (id: string) => void
  getCurrentChapter: () => Chapter | undefined
  recalcChapterWordCount: (id: string) => void
  saveChapterContent: (id: string, content: string) => void

  // Conversation actions
  createConversation: (title?: string) => Conversation
  deleteConversation: (id: string) => void
  setActiveConversation: (id: string) => void
  addMessage: (conversationId: string, message: ChatMessage) => void
  updateConversationTitle: (id: string, title: string) => void
}
