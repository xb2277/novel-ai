import { useState, useRef, useEffect } from 'react'
import { useStore } from '../stores/useStore'
import { BookIcon, EditIcon, CheckIcon, XIcon, PlusIcon, TrashIcon } from './icons'

export default function NovelSwitcher() {
  const { novels, currentNovelId, switchToNovel, createNovel, renameNovel, deleteNovel } = useStore()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  // Click outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setEditingId(null)
        setDeletingId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus edit input
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus()
      editInputRef.current.select()
    }
  }, [editingId])

  const handleSwitch = (id: string) => {
    if (id === currentNovelId) return
    switchToNovel(id)
    setOpen(false)
  }

  const handleCreate = () => {
    createNovel()
    setOpen(false)
  }

  const handleStartRename = (id: string, title: string) => {
    setEditingId(id)
    setEditName(title)
    setDeletingId(null)
  }

  const handleCommitRename = (id: string) => {
    if (editName.trim()) {
      renameNovel(id, editName.trim())
    }
    setEditingId(null)
  }

  const handleDelete = (id: string) => {
    if (novels.length <= 1) return // Must keep at least one novel
    setDeletingId(deletingId === id ? null : id)
    setEditingId(null)
  }

  const confirmDelete = (id: string) => {
    deleteNovel(id)
    setDeletingId(null)
    if (novels.length <= 2) setOpen(false) // Close if last deleted
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`btn-ghost text-xs ${open ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
        title="书架"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
          <path d="M4 4.5A2.5 2.5 0 016.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
        <span className="hidden sm:inline">书架</span>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-1 w-[240px] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg z-50 font-ui"
        >
          <div className="max-h-[320px] overflow-y-auto py-1">
            {/* Current novel hint */}
            <div className="px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] font-medium">
              📖 当前小说
            </div>

            {novels.map((novel) => {
              const isCurrent = novel.id === currentNovelId
              const isEditing = editingId === novel.id
              const isConfirmDelete = deletingId === novel.id

              return (
                <div key={novel.id}>
                  <div
                    onClick={() => isCurrent ? undefined : handleSwitch(novel.id)}
                    className={`flex items-center gap-2 px-3 py-[6px] text-[13px] transition-colors group ${
                      isCurrent
                        ? 'bg-[var(--color-accent-light)]/60 text-[var(--color-accent)] font-medium cursor-default'
                        : 'hover:bg-[var(--color-bg)] cursor-pointer text-[var(--color-text)]'
                    }`}
                  >
                    <BookIcon size={13} />

                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => handleCommitRename(novel.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename(novel.id)
                          if (e.key === 'Escape') setEditingId(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 outline-none bg-[var(--color-accent-light)]/50 px-1 rounded text-[13px] min-w-0"
                      />
                    ) : (
                      <span className="flex-1 truncate">{novel.title}</span>
                    )}

                    {/* Hover actions */}
                    {!isEditing && !isConfirmDelete && (
                      <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleStartRename(novel.id, novel.title) }}
                          className="p-0.5 rounded hover:bg-[var(--color-border)]/50"
                          title="重命名"
                        >
                          <EditIcon size={11} />
                        </button>
                        {novels.length > 1 && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(novel.id) }}
                            className="p-0.5 rounded hover:bg-red-50 hover:text-red-500"
                            title="删除"
                          >
                            <TrashIcon size={11} />
                          </button>
                        )}
                      </span>
                    )}

                    {/* Confirm delete */}
                    {isConfirmDelete && (
                      <span className="flex items-center gap-1 shrink-0 text-[11px]">
                        <span className="text-red-500">删除?</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); confirmDelete(novel.id) }}
                          className="text-green-600 hover:bg-green-50 rounded p-0.5"
                        >
                          <CheckIcon size={11} />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeletingId(null) }}
                          className="text-[var(--color-text-secondary)] hover:bg-[var(--color-border)]/50 rounded p-0.5"
                        >
                          <XIcon size={11} />
                        </button>
                      </span>
                    )}
                  </div>

                  {/* Other novels separator before first non-current */}
                  {isCurrent && novels.length > 1 && (
                    <div className="px-3 py-1.5 text-[11px] text-[var(--color-text-secondary)] font-medium mt-1">
                      其他作品
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Add new */}
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 w-full px-3 py-2.5 text-[13px] text-[var(--color-accent)] hover:bg-[var(--color-accent-light)]/30 transition-colors border-t border-[var(--color-border)] rounded-b-xl"
          >
            <PlusIcon size={13} />
            添加新书
          </button>
        </div>
      )}
    </div>
  )
}
