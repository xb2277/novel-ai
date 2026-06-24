import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { logout } from '../services/authService'
import AuthModal from './AuthModal'

export default function UserMenu() {
  const { user, isAdmin } = useAuthStore()
  const [showAuth, setShowAuth] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  const profile = user?.user_metadata as { username?: string } | undefined
  const displayName = profile?.username || user?.email?.split('@')[0] || '用户'

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuth(true)}
          className="btn-ghost text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span className="hidden sm:inline">登录</span>
        </button>
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      </>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={`btn-ghost text-xs ${menuOpen ? '!bg-[var(--color-accent-light)] !text-[var(--color-accent)]' : ''}`}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="hidden sm:inline">{displayName}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-[150px] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1">
          {isAdmin && (
            <a
              href="#/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors no-underline"
            >
              后台管理
            </a>
          )}
          <button
            onClick={() => { setMenuOpen(false); logout() }}
            className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
