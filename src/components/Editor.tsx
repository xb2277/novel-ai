import { useCallback, useEffect, useState, useRef } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { v4 as uuidv4 } from 'uuid'
import { useStore } from '../stores/useStore'
import { generateSuggestions, generateMockSuggestions, generateObservation, generateMockObservation } from '../services/ai'
import ReferencePanel from './ReferencePanel'
import { BookIcon, SparkleIcon, EyeIcon } from './icons'

const TOOLBAR_ITEMS = [
  { action: 'bold', label: 'B', title: '加粗' },
  { action: 'italic', label: 'I', title: '斜体', style: 'italic' },
  { action: 'strike', label: 'S', title: '删除线', style: 'line-through' },
] as const

export default function Editor() {
  const {
    selectedText, setSelectedText, setSuggestions, setLoading,
    setSidePanelOpen, isLoading, settings,
    chapters, currentChapterId,
    autoObserve, setAutoObserve,
  } = useStore()

  const referenceOpen = useStore((s) => s.referenceOpen)
  const toggleReference = useStore((s) => s.toggleReference)
  const currentChapter = chapters.find((ch) => ch.id === currentChapterId)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'dirty' | 'saving'>('saved')
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('editor-font-size')
    return saved ? parseInt(saved, 10) : 16
  })
  const [floatingPos, setFloatingPos] = useState<{ top: number; left: number } | null>(null)
  const [titleValue, setTitleValue] = useState('')
  const editorRef = useRef<HTMLDivElement>(null)
  const editorAreaRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLInputElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const titleSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const observeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const currentChapterIdRef = useRef(currentChapterId)
  const isObservingRef = useRef(false)

  const content = currentChapter?.content || '<p></p>'

  // Sync title input when chapter changes
  useEffect(() => {
    if (currentChapter) {
      setTitleValue(currentChapter.title)
    }
  }, [currentChapterId])

  const handleTitleChange = (val: string) => {
    setTitleValue(val)
    if (!currentChapterIdRef.current) return
    clearTimeout(titleSaveTimerRef.current)
    titleSaveTimerRef.current = setTimeout(() => {
      useStore.getState().updateChapter(currentChapterIdRef.current!, { title: val.trim() || '未命名' })
    }, 500)
  }

  const handleTitleBlur = () => {
    if (!currentChapterIdRef.current) return
    useStore.getState().updateChapter(currentChapterIdRef.current!, {
      title: titleValue.trim() || '未命名',
    })
  }

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '开始书写你的故事... 选中任意段落，召唤 AI 灵感',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!currentChapterIdRef.current) return
      setSaveStatus('dirty')
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(() => {
        setSaveStatus('saving')
        const html = editor.getHTML()
        useStore.getState().saveChapterContent(currentChapterIdRef.current!, html)
        setSaveStatus('saved')
      }, 800)

      // Schedule AI observation on content change
      scheduleObservation()
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection
      if (empty) {
        setFloatingPos(null)
        setSelectedText('')
        return
      }
      const text = editor.state.doc.textBetween(from, to, ' ')
      if (text.trim().length < 2) {
        setFloatingPos(null)
        setSelectedText('')
        return
      }
      setSelectedText(text)

      const { view } = editor
      const end = view.coordsAtPos(to)
      const areaBox = editorAreaRef.current?.getBoundingClientRect()
      if (!areaBox) return

      // Position the button just past the end of the selection, on the same line
      setFloatingPos({
        top: end.top - areaBox.top - 2,
        left: end.right - areaBox.left + 4,
      })
    },
  })

  useEffect(() => {
    currentChapterIdRef.current = currentChapterId
  }, [currentChapterId])

  // Switch chapter content; focus body after render
  useEffect(() => {
    if (editor && currentChapter) {
      const editorHtml = editor.getHTML()
      const storedHtml = currentChapter.content
      if (editorHtml !== storedHtml) {
        editor.commands.setContent(storedHtml || '<p></p>')
        setTimeout(() => {
          const docSize = editor.state.doc.content.size
          editor.commands.focus(docSize)
        }, 30)
      }
    }
  }, [currentChapterId])

  // Autosave on unmount
  useEffect(() => {
    return () => {
      if (editor && currentChapterIdRef.current) {
        const html = editor.getHTML()
        useStore.getState().saveChapterContent(currentChapterIdRef.current, html)
      }
    }
  }, [])

  const handleAskAI = useCallback(async () => {
    if (!selectedText || isLoading) return
    setLoading(true)
    setSidePanelOpen(true)
    try {
      if (settings.apiKey) {
        const suggestions = await generateSuggestions(settings, selectedText)
        setSuggestions(suggestions)
      } else {
        const suggestions = await generateMockSuggestions(selectedText)
        setSuggestions(suggestions)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '未知错误'
      setSuggestions([
        { id: 'err', label: '出错了', text: msg },
      ])
    } finally {
      setLoading(false)
    }
  }, [selectedText, isLoading, setLoading, setSidePanelOpen, setSuggestions, settings])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        handleAskAI()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleAskAI])

  // ===== Auto-observe: debounce typing → trigger AI observation =====
  const triggerObservation = useCallback(async () => {
    if (!autoObserve || !currentChapterIdRef.current || isObservingRef.current) return

    const chapter = useStore.getState().chapters.find(
      (ch) => ch.id === currentChapterIdRef.current
    )
    if (!chapter) return

    const plainText = chapter.content.replace(/<[^>]*>/g, '').trim()
    if (plainText.length < 20) return

    isObservingRef.current = true

    // Find AI灵感页 to post observation results
    const currentConversations = useStore.getState().conversations
    const inspirConv = currentConversations.find((c) => c.title === 'AI灵感页')
    if (!inspirConv) {
      isObservingRef.current = false
      return
    }

    try {
      let observations: { label: string; text: string }[]
      if (settings.apiKey) {
        observations = await generateObservation(settings, chapter.content)
      } else {
        observations = await generateMockObservation(chapter.content)
      }

      const content = observations
        .map((o) => `**【${o.label}】**\n${o.text}`)
        .join('\n\n')

      const existingMessages = inspirConv.messages
      // Avoid duplicate observations if content hasn't changed
      const lastMsg = existingMessages[existingMessages.length - 1]
      if (lastMsg?.content === content) {
        isObservingRef.current = false
        return
      }

      useStore.getState().addMessage(inspirConv.id, {
        id: uuidv4(),
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      })
    } catch {
      // Silently ignore observation errors so they don't disrupt writing
    } finally {
      isObservingRef.current = false
    }
  }, [autoObserve, settings])

  // Debounce observation on content change (via onUpdate)
  // We schedule a trigger after 3s of no typing
  useEffect(() => {
    if (!autoObserve) return
    // This effect reacts to autoObserve being toggled — the actual scheduling
    // happens inside the editor's onUpdate callback
  }, [autoObserve])

  const scheduleObservation = useCallback(() => {
    if (!autoObserve) return
    clearTimeout(observeTimerRef.current)
    observeTimerRef.current = setTimeout(() => {
      triggerObservation()
    }, 2500)
  }, [autoObserve, triggerObservation])

  // Cleanup observe timer on unmount
  useEffect(() => {
    return () => clearTimeout(observeTimerRef.current)
  }, [])

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      editor?.commands.focus('end')
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      editor?.commands.focus('end')
    }
  }

  if (!editor) return null

  return (
    <div className="flex flex-col h-full" ref={editorRef}>
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] font-ui shrink-0">
        {TOOLBAR_ITEMS.map((item) => (
          <button
            key={item.action}
            onClick={() => editor.chain().focus().toggleMark(item.action as string).run()}
            className={`btn-ghost text-sm min-w-[32px] justify-center ${
              editor.isActive(item.action) ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''
            }`}
            title={item.title}
          >
            <span style={'style' in item ? { fontStyle: item.style } : { fontWeight: 600 }}>
              {item.label}
            </span>
          </button>
        ))}
        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
        <button
          onClick={() => {
            const s = Math.max(10, fontSize - 1)
            setFontSize(s)
            localStorage.setItem('editor-font-size', String(s))
          }}
          disabled={fontSize <= 10}
          className="btn-ghost text-sm min-w-[28px] justify-center disabled:opacity-30"
          title="缩小字号"
        >
          A<sup style={{ fontSize: 9 }}>-</sup>
        </button>
        <span className="text-[11px] text-[var(--color-text-secondary)] min-w-[28px] text-center">{fontSize}</span>
        <button
          onClick={() => {
            const s = Math.min(28, fontSize + 1)
            setFontSize(s)
            localStorage.setItem('editor-font-size', String(s))
          }}
          disabled={fontSize >= 28}
          className="btn-ghost text-sm min-w-[28px] justify-center disabled:opacity-30"
          title="放大字号"
        >
          A<sup style={{ fontSize: 12 }}>+</sup>
        </button>
        <div className="flex-1" />

        {/* Save status indicator */}
        <span className={`text-[11px] mr-2 transition-colors ${
          saveStatus === 'saved' ? 'text-green-600' :
          saveStatus === 'saving' ? 'text-[var(--color-accent)]' :
          'text-[var(--color-text-secondary)]/50'
        }`}>
          {saveStatus === 'saving' ? '保存中...' :
           saveStatus === 'saved' ? '✓ 已保存' :
           '未保存'}
        </span>

        <button
          onClick={toggleReference}
          className={`btn-ghost text-xs ${referenceOpen ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
          title="参考资料"
        >
          <BookIcon size={14} />
          <span className="hidden sm:inline">参考资料</span>
        </button>

        {/* Auto-observe toggle */}
        <button
          onClick={() => setAutoObserve(!autoObserve)}
          className={`btn-ghost text-xs gap-1 ${autoObserve ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
          title={autoObserve ? '关闭实时观察' : '开启实时观察 — AI 将自动观察你的写作并给出建议'}
        >
          <EyeIcon size={14} active={autoObserve} />
          <span className="hidden sm:inline">实时观察</span>
        </button>

        {currentChapter && (
          <span className="text-[11px] text-[var(--color-text-secondary)] mr-2">
            {currentChapter.wordCount.toLocaleString()} 字
          </span>
        )}

        <button
          onClick={handleAskAI}
          disabled={!selectedText || isLoading}
          className="btn-primary text-sm"
        >
          {isLoading ? (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              思考中
            </span>
          ) : (
            <>
              <SparkleIcon />
              AI 灵感
            </>
          )}
        </button>
      </div>

      {/* Main content area: editor + optional reference panel */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Scrollable editor area */}
        <div className="flex-1 overflow-auto relative">
          <div className="mx-auto px-8 pt-6 pb-12" style={{ maxWidth: fontSize * 45 }}>
            {/* Chapter title — editable, syncs to sidebar */}
            <div className="mb-6">
              <input
                ref={titleRef}
                value={titleValue}
                onChange={(e) => handleTitleChange(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={handleTitleKeyDown}
                placeholder="在此输入章节标题..."
                className="w-full text-2xl font-medium outline-none bg-transparent text-[var(--color-text)] placeholder:text-[var(--color-text-secondary)]/40 pb-2 border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-accent)]/40 transition-colors"
              />
            </div>

            <style>{`
              .ProseMirror {
                outline: none;
                min-height: 300px;
                font-size: ${fontSize}px;
                line-height: 1.9;
                color: var(--color-text);
              }
              .ProseMirror p {
                margin: 0.5em 0;
                text-indent: 2em;
              }
              .ProseMirror p:first-child {
                margin-top: 0;
              }
              .ProseMirror p.is-editor-empty:first-child::before {
                content: attr(data-placeholder);
                float: left;
                color: #c0bdb5;
                pointer-events: none;
                height: 0;
                text-indent: 2em;
              }
              .ProseMirror h1 { font-size: 24px; font-weight: 500; margin: 0.8em 0 0.4em; text-indent: 0; }
              .ProseMirror h2 { font-size: 20px; font-weight: 500; margin: 0.6em 0 0.3em; text-indent: 0; }
              .ProseMirror h3 { font-size: 18px; font-weight: 500; margin: 0.4em 0 0.2em; text-indent: 0; }
              .editor-area { position: relative; }
            `}</style>

            <div className="editor-area" ref={editorAreaRef}>
              <EditorContent editor={editor} />

              {floatingPos && selectedText && (
                <div
                  className="absolute z-10 animate-[fadeIn_0.15s_ease] whitespace-nowrap"
                  style={{ top: floatingPos.top, left: floatingPos.left }}
                >
                  <button
                    onClick={handleAskAI}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-md bg-[var(--color-accent)] text-white shadow-md hover:shadow-lg hover:brightness-110 transition-all cursor-pointer border-0"
                    title="Ctrl+K"
                  >
                    <SparkleIcon size={11} />
                    改写这句
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reference panel slides in below editor */}
        <div
          className={`shrink-0 border-t-2 border-[var(--color-border)] transition-all duration-200 overflow-hidden ${
            referenceOpen ? 'h-[35%]' : 'h-0'
          }`}
        >
          <ReferencePanel />
        </div>
      </div>
    </div>
  )
}
