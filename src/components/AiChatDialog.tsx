import { useState, useRef, useEffect } from 'react'
import { useStore, type ChatMessage } from '../stores/useStore'
import { sendChatMessage, sendMockChatMessage } from '../services/ai'
import { v4 as uuidv4 } from 'uuid'
import { LightningIcon, ChatIcon, StarIcon, CloseIcon, PlusIcon, SendIcon } from './icons'
import MessageRenderer from './MessageRenderer'

const INSPIRATION_TAB_TITLE = 'AI灵感页'


export default function AiChatDialog() {
  const {
    conversations,
    activeConversationId,
    settings,
    suggestions,
    isLoading: aiGenerating,
    selectedText,
    createConversation,
    deleteConversation,
    setActiveConversation,
    addMessage,
  } = useStore()

  const activeConversation = conversations.find((c) => c.id === activeConversationId)
  const isInspirationTab = activeConversation?.title === INSPIRATION_TAB_TITLE

  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const lastSuggestionIdsRef = useRef<string>('')

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConversation?.messages])

  // Auto-focus input when switching conversations
  useEffect(() => {
    inputRef.current?.focus()
  }, [activeConversationId])

  // ===== Inject suggestions into AI灵感页 =====
  useEffect(() => {
    if (suggestions.length === 0) return
    const ids = suggestions.map((s) => s.id).join(',')
    if (ids === lastSuggestionIdsRef.current) return
    lastSuggestionIdsRef.current = ids

    const store = useStore.getState()

    // Find or create AI灵感页
    let inspirConv = store.conversations.find((c) => c.title === INSPIRATION_TAB_TITLE)
    if (!inspirConv) {
      inspirConv = store.createConversation(INSPIRATION_TAB_TITLE)
    }

    // Build formatted message from suggestions
    const content = suggestions
      .map((s) => `**【${s.label}】**\n${s.text}`)
      .join('\n\n')

    const msg: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content,
      timestamp: new Date().toISOString(),
    }

    // If the latest message in AI灵感页 is already this batch, skip
    const lastMsg = inspirConv.messages[inspirConv.messages.length - 1]
    if (lastMsg?.content === content) return

    store.addMessage(inspirConv.id, msg)
    store.setActiveConversation(inspirConv.id)

    // Clear store suggestions so we don't re-process
    store.clearSuggestions()
  }, [suggestions])

  // ===== Handle send =====
  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    setInput('')
    setError(null)

    // If on AI灵感页, create a new conversation tab for chatting
    let convId = activeConversationId
    if (isInspirationTab || !convId) {
      const conv = createConversation('新对话')
      convId = conv.id
    }

    // Get existing messages for context
    const existingMessages =
      conversations.find((c) => c.id === convId)?.messages ?? []

    const userMsg: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    addMessage(convId, userMsg)
    setSending(true)

    try {
      const allMessages = [...existingMessages, userMsg]

      let reply: string
      if (settings.apiKey) {
        reply = await sendChatMessage(settings, allMessages, text)
      } else {
        reply = await sendMockChatMessage(text)
      }

      const assistantMsg: ChatMessage = {
        id: uuidv4(),
        role: 'assistant',
        content: reply,
        timestamp: new Date().toISOString(),
      }
      addMessage(convId, assistantMsg)
    } catch (err: any) {
      setError(err.message || '发送失败')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleNewConversation = () => {
    createConversation('新对话')
  }

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const conv = conversations.find((c) => c.id === id)
    // Don't allow deleting the inspiration tab
    if (conv?.title === INSPIRATION_TAB_TITLE) return
    deleteConversation(id)
  }

  // Ensure at least AI灵感页 exists on mount
  useEffect(() => {
    const store = useStore.getState()
    if (store.conversations.length === 0) {
      store.createConversation(INSPIRATION_TAB_TITLE)
    }
  }, [])

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface)]">
      {/* Tab bar */}
      <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-bg)] overflow-x-auto shrink-0">
        <div className="flex items-center flex-1 min-w-0">
          {conversations.map((conv) => {
            const isActive = activeConversationId === conv.id
            const isFixed = conv.title === INSPIRATION_TAB_TITLE
            return (
              <div
                key={conv.id}
                onClick={() => setActiveConversation(conv.id)}
                className={`group flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer border-r border-[var(--color-border)] whitespace-nowrap transition-colors shrink-0 max-w-[160px] ${
                  isActive
                    ? 'bg-[var(--color-surface)] text-[var(--color-text)] border-b-2 border-b-[var(--color-accent)] -mb-[1px] font-medium'
                    : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-light)]/30'
                }`}
              >
                {isFixed && <LightningIcon />}
                <span className="truncate">{conv.title}</span>
                {!isFixed && (
                  <button
                    onClick={(e) => handleDeleteConversation(conv.id, e)}
                    className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-[var(--color-border)] transition-all"
                    title="关闭对话"
                  >
                    <CloseIcon />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <button
          onClick={handleNewConversation}
          className="shrink-0 px-2.5 py-2 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]/30 transition-colors border-l border-[var(--color-border)]"
          title="新对话"
        >
          <PlusIcon size={14} />
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* AI灵感页 empty state */}
        {isInspirationTab &&
          (!activeConversation || activeConversation.messages.length === 0) &&
          !aiGenerating && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="text-2xl mb-2 opacity-15">
                <StarIcon />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                开启工具栏的「实时观察」
                <br />
                AI 会自动观察你的写作，持续给出
                <br />
                润色、续写灵感和一致性建议
              </p>
              {selectedText && (
                <div className="mt-3 px-3 py-1.5 bg-[var(--color-accent-light)]/40 rounded-lg text-xs text-[var(--color-text-secondary)] italic">
                  &ldquo;{selectedText}&rdquo;
                </div>
              )}
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-3 opacity-50">
                也可以选中文字按 Ctrl+K
                <br />
                对特定段落进行多种风格改写
              </p>
            </div>
          )}

        {/* Normal conversation empty state */}
        {!isInspirationTab &&
          (!activeConversation || activeConversation.messages.length === 0) && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="text-2xl mb-2 opacity-15">
                <ChatIcon size={40} />
              </div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
                与 AI 自由对话
                <br />
                讨论剧情、人物、设定，获取写作灵感
              </p>
            </div>
          )}

        {/* Loading skeleton during AI generation */}
        {isInspirationTab && aiGenerating && (
          <div className="space-y-4">
            <div className="p-3 bg-[var(--color-accent-light)]/20 rounded-lg border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-3 text-xs text-[var(--color-accent)] font-medium">
                <span className="inline-block w-3 h-3 border-2 border-[var(--color-accent)]/30 border-t-[var(--color-accent)] rounded-full animate-spin" />
                正在为「{selectedText?.slice(0, 20)}…」生成灵感建议
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5 animate-pulse">
                    <div className="h-3 bg-[var(--color-accent)]/10 rounded w-12" />
                    <div className="h-3 bg-[var(--color-accent)]/10 rounded w-full" />
                    <div className="h-3 bg-[var(--color-accent)]/10 rounded w-4/5" />
                  </div>
                ))}
              </div>
            </div>
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Messages */}
        {activeConversation &&
          activeConversation.messages.length > 0 &&
          !(isInspirationTab && aiGenerating) && (
            <>
              {activeConversation.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[var(--color-accent)] text-white'
                        : 'bg-[var(--color-bg)] text-[var(--color-text)] border border-[var(--color-border)]'
                    }`}
                  >
                    {msg.role === 'assistant' ? (
                      <MessageRenderer content={msg.content} />
                    ) : (
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-bounce"
                        style={{ animationDelay: '0ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-bounce"
                        style={{ animationDelay: '150ms' }}
                      />
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-[var(--color-text-secondary)] animate-bounce"
                        style={{ animationDelay: '300ms' }}
                      />
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="flex justify-center">
                  <p className="text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded">
                    {error}
                  </p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
      </div>

      {/* Input area */}
      <div className="border-t border-[var(--color-border)] p-2 shrink-0 bg-[var(--color-surface)]">
        <div className="flex items-end gap-1.5">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isInspirationTab
                ? '想和 AI 聊天？直接输入后发送，将自动创建新对话...'
                : '输入消息，Enter 发送，Shift+Enter 换行...'
            }
            rows={2}
            disabled={sending}
            className="flex-1 resize-none text-xs bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 outline-none focus:border-[var(--color-accent)] transition-colors placeholder:text-[var(--color-text-secondary)]/50 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
