import { useStore, type OutlineNode } from '../stores/useStore'
import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { BookIcon, EditIcon, XIcon } from './icons'

/** Find a node by id in the outline tree */
function findNode(nodes: OutlineNode[], id: string): OutlineNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const found = findNode(n.children, id)
    if (found) return found
  }
  return null
}

export default function ReferencePanel() {
  const outlines = useStore((s) => s.outlines)
  const selectedId = useStore((s) => s.selectedOutlineNodeId)
  const toggleReference = useStore((s) => s.toggleReference)
  const updateOutlineNode = useStore((s) => s.updateOutlineNode)
  const setNovelTitle = useStore((s) => s.setNovelTitle)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const node = useMemo(() => {
    if (!selectedId) return null
    return findNode(outlines, selectedId)
  }, [outlines, selectedId])

  // Sync draft when node changes
  useEffect(() => {
    setDraft(node?.content || '')
    setEditing(false)
  }, [node?.id])

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length)
    }
  }, [editing])

  const handleSave = useCallback(() => {
    if (!node || !selectedId) return
    updateOutlineNode(selectedId, { content: draft })
    // 如果编辑的是"书名"节点，同步更新书架上的小说标题
    if (node.title === '书名' && draft.trim()) {
      setNovelTitle(draft.trim())
    }
    setEditing(false)
  }, [node, selectedId, draft, updateOutlineNode, setNovelTitle])

  const handleCancel = useCallback(() => {
    setDraft(node?.content || '')
    setEditing(false)
  }, [node])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
    // Ctrl+Enter to save
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSave()
    }
  }, [handleCancel, handleSave])

  return (
    <div className="h-full flex flex-col font-ui bg-[var(--color-surface)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] shrink-0">
        <h3 className="text-sm font-medium flex items-center gap-1.5 truncate">
          <BookIcon size={15} />
          <span className="truncate">{node ? node.title : '参考资料'}</span>
        </h3>
        <div className="flex items-center gap-1 shrink-0">
          {node && !editing && (
            <button
              onClick={() => { setDraft(node.content || ''); setEditing(true) }}
              className="btn-ghost text-xs p-1"
              title="编辑"
            >
              <EditIcon size={14} />
            </button>
          )}
          <button onClick={toggleReference} className="btn-ghost text-xs p-1">
            <XIcon size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-3">
        {!node && (
          <p className="text-xs text-[var(--color-text-secondary)] text-center py-8 leading-relaxed">
            请在左侧「作品设定」中<br />点击一个条目查看内容
          </p>
        )}

        {node && !editing && (
          <div className="card">
            {node.content ? (
              <div
                className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap"
              >
                {node.content}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-text-secondary)] italic">
                暂无内容，点击顶栏编辑按钮添加。
              </p>
            )}
          </div>
        )}

        {node && editing && (
          <div className="card">
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="在此填写内容..."
              className="w-full min-h-[200px] resize-y p-3 text-sm text-[var(--color-text)] bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30 focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-secondary)]/50 leading-relaxed"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[11px] text-[var(--color-text-secondary)]">
                Ctrl+Enter 保存 · Esc 取消
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3 py-1 text-xs rounded border border-[var(--color-border)] hover:bg-[var(--color-bg)] transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1 text-xs rounded bg-[var(--color-accent)] text-white hover:opacity-90 transition-colors"
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
