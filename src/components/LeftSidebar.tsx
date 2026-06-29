import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, findInTree, type OutlineNode, type Chapter } from '../stores/useStore'
import { getNextChapterTitle } from '../services/chapterNumber'
import { v4 as uuidv4 } from 'uuid'
import { ChevronDownIcon, ChevronRightIcon, DotIcon, EditIcon, PlusIcon, TrashIcon, CheckIcon, XIcon } from './icons'

const MIN_RAT_IO = 0.15
const MAX_RAT_IO = 0.85

export default function LeftSidebar() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ratio, setRatio] = useState(0.45)
  const dragging = useRef(false)

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragging.current = true
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'row-resize'
  }, [])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const y = e.clientY - rect.top
      const r = Math.min(MAX_RAT_IO, Math.max(MIN_RAT_IO, y / rect.height))
      setRatio(r)
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div ref={containerRef} className="flex flex-col h-full bg-[var(--color-surface)] border-r border-[var(--color-border)] font-ui">
      <div style={{ height: `${ratio * 100}%`, minHeight: 0 }} className="overflow-auto">
        <OutlineTree />
      </div>

      {/* Draggable divider */}
      <div
        className="shrink-0 group cursor-row-resize relative z-20"
        style={{ height: 8 }}
        onMouseDown={onMouseDown}
      >
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-[var(--color-border)] group-hover:bg-[var(--color-accent)] transition-colors" />
      </div>

      <div style={{ height: `${(1 - ratio) * 100}%`, minHeight: 0 }} className="overflow-auto">
        <ChapterList />
      </div>
    </div>
  )
}

// ===== Outline Tree =====

function OutlineTree() {
  const { outlines, novelTitle, selectedOutlineNodeId, addOutlineNode, updateOutlineNode, removeOutlineNode, toggleOutlineNode, setSelectedOutlineNodeId, toggleReference, setNovelTitle } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startEdit = (node: OutlineNode) => {
    setEditingId(node.id)
    setEditTitle(node.title)
  }

  const commitEdit = (id: string) => {
    if (editTitle.trim()) {
      // 找到被编辑的节点，判断是否是「书名」
      const node = findInTree(outlines, id)
      if (node && node.title === '书名') {
        setNovelTitle(editTitle.trim())
      }
      updateOutlineNode(id, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  const handleAddChild = (parentId: string) => {
    const newNode: OutlineNode = {
      id: uuidv4(),
      title: '新节点',
      content: '',
      expanded: true,
      children: [],
    }
    addOutlineNode(parentId, newNode)
    setEditingId(newNode.id)
    setEditTitle('新节点')
    setTimeout(() => {
      const el = document.getElementById(`outline-edit-${newNode.id}`) as HTMLInputElement | null
      el?.focus()
      el?.select()
    }, 50)
  }

  const handleNodeClick = (node: OutlineNode) => {
    // Toggle expand/collapse for parent nodes
    if (node.children.length > 0) {
      toggleOutlineNode(node.id)
    }
    // Always set as selected, open reference panel
    setSelectedOutlineNodeId(node.id)
    // Open reference panel if not already open
    const state = useStore.getState()
    if (!state.referenceOpen) {
      toggleReference()
    }
  }

  const renderNode = (node: OutlineNode, depth: number) => {
    const hasChildren = node.children.length > 0
    const isEditing = editingId === node.id

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-1 px-2 py-[3px] cursor-pointer hover:bg-[var(--color-accent-light)]/40 group text-[13px] ${
            selectedOutlineNodeId === node.id ? 'bg-[var(--color-accent-light)]/60' : ''
          }`}
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => handleNodeClick(node)}
        >
          <span className="w-[14px] flex items-center justify-center shrink-0 text-[10px] text-[var(--color-text-secondary)]">
            {hasChildren ? (node.expanded ? <ChevronDownIcon size={10} /> : <ChevronRightIcon size={10} />) : <DotIcon size={10} />}
          </span>

          {isEditing ? (
            <input
              id={`outline-edit-${node.id}`}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onBlur={() => commitEdit(node.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit(node.id)
                if (e.key === 'Escape') setEditingId(null)
              }}
              className="flex-1 outline-none bg-[var(--color-accent-light)]/50 px-1 rounded text-[13px] min-w-0"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-[var(--color-text)]">
              {node.title === '书名' && novelTitle ? novelTitle : node.title}
            </span>
          )}

          <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              onClick={(e) => { e.stopPropagation(); startEdit(node) }}
              className="p-0.5 rounded hover:bg-[var(--color-border)]/50"
              title="重命名"
            >
              <EditIcon size={11} />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleAddChild(node.id) }}
              className="p-0.5 rounded hover:bg-[var(--color-border)]/50"
              title="添加子节点"
            >
              <PlusIcon size={11} />
            </button>
            {depth > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); removeOutlineNode(node.id) }}
                className="p-0.5 rounded hover:bg-red-50 hover:text-red-500"
                title="删除"
              >
                <TrashIcon size={11} />
              </button>
            )}
          </span>
        </div>

        {hasChildren && node.expanded && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="py-2">
      <div className="px-3 pb-2">
        <div className="text-[13px] font-bold text-[var(--color-text)] mb-1">
          作品设定
        </div>
      </div>

      <div className="mt-1">
        {outlines.map((node) => renderNode(node, 0))}
      </div>
    </div>
  )
}

// ===== Chapter List =====

function ChapterList() {
  const { chapters, currentChapterId, setCurrentChapter, addChapter, removeChapter, updateChapter } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [addMode, setAddMode] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (addMode && inputRef.current) {
      inputRef.current.focus()
    }
  }, [addMode])

  const handleAdd = () => {
    if (!newTitle.trim()) return
    addChapter({ title: newTitle.trim() })
    setNewTitle('')
    setAddMode(false)
  }

  const startEdit = (ch: Chapter) => {
    setEditingId(ch.id)
    setEditTitle(ch.title)
  }

  const commitEdit = (id: string) => {
    if (editTitle.trim()) {
      updateChapter(id, { title: editTitle.trim() })
    }
    setEditingId(null)
  }

  const handleRemove = (id: string) => {
    const ch = chapters.find((c) => c.id === id)
    if (!ch) return
    if (!confirm(`删除「${ch.title}」？此操作不可撤销。`)) return
    removeChapter(id)
  }

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 pb-1">
        <span className="text-[13px] font-bold text-[var(--color-text)]">
          写作目录
        </span>
        <button
          onClick={() => { setNewTitle(getNextChapterTitle(chapters)); setAddMode(true) }}
          className="p-0.5 rounded hover:bg-[var(--color-accent-light)]/50 text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
          title="添加章节"
        >
          <PlusIcon size={13} />
        </button>
      </div>

      {addMode && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1 bg-[var(--color-bg)] rounded border border-[var(--color-border)] px-2 py-1">
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd()
                if (e.key === 'Escape') setAddMode(false)
              }}
              onBlur={() => { if (!newTitle.trim()) setAddMode(false) }}
              placeholder="章节名"
              className="flex-1 outline-none bg-transparent text-[13px] min-w-0"
              autoFocus
            />
            <button onClick={handleAdd} className="text-[var(--color-accent)] p-0.5">
              <CheckIcon size={12} />
            </button>
            <button onClick={() => setAddMode(false)} className="text-[var(--color-text-secondary)] p-0.5">
              <XIcon size={12} />
            </button>
          </div>
        </div>
      )}

      <div className="space-y-px">
        {chapters.map((ch) => {
          const isActive = ch.id === currentChapterId
          const isEditing = editingId === ch.id

          return (
            <div
              key={ch.id}
              onClick={() => setCurrentChapter(ch.id)}
              className={`group flex items-center gap-2 px-3 py-[5px] cursor-pointer transition-colors text-[13px] ${
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent)]'
                  : 'hover:bg-[var(--color-bg)] text-[var(--color-text)]'
              }`}
            >
              {isEditing ? (
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={() => commitEdit(ch.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(ch.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 outline-none bg-white/50 px-1 rounded text-[13px] min-w-0"
                  autoFocus
                />
              ) : (
                <span className="flex-1 truncate">{ch.title}</span>
              )}

              <span className="text-[11px] text-[var(--color-text-secondary)] shrink-0">
                {ch.wordCount.toLocaleString()}字
              </span>

              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); startEdit(ch) }}
                  className="p-0.5 rounded hover:bg-[var(--color-border)]/50"
                  title="重命名"
                >
                  <EditIcon size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(ch.id) }}
                  className="p-0.5 rounded hover:bg-red-50 hover:text-red-500"
                  title="删除"
                >
                  <TrashIcon size={11} />
                </button>
              </span>
            </div>
          )
        })}
      </div>

      {chapters.length > 0 && <ChapterStats chapters={chapters} />}
    </div>
  )
}

// ===== Stats =====

function ChapterStats({ chapters }: { chapters: Chapter[] }) {
  const totalWords = chapters.reduce((sum, ch) => sum + ch.wordCount, 0)
  const totalChs = chapters.length

  return (
    <div className="mt-1 px-3 py-2 border-t border-[var(--color-border)] flex items-center gap-4 text-[11px] text-[var(--color-text-secondary)]">
      <span>共 <span className="text-[var(--color-accent)] font-medium">{totalChs}</span> 章</span>
      <span>总计 <span className="text-[var(--color-accent)] font-medium">{totalWords.toLocaleString()}</span> 字</span>
    </div>
  )
}
