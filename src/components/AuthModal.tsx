import { useState, useRef, useEffect } from 'react'
import { register, login } from '../services/authService'

interface Props {
  open: boolean
  onClose: () => void
}

export default function AuthModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  // Reset fields on tab switch
  useEffect(() => {
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }, [tab])

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!email.trim() || !password) {
      setError('请填写邮箱和密码')
      return
    }

    if (tab === 'register') {
      if (!username.trim()) { setError('请填写用户名'); return }
      if (password.length < 6) { setError('密码至少6位'); return }
      if (password !== confirmPassword) { setError('两次密码不一致'); return }
    }

    setLoading(true)
    try {
      // Wrap with timeout to prevent infinite hang
      await Promise.race([
        (async () => {
          if (tab === 'login') {
            await login(email.trim(), password)
          } else {
            await register(username.trim(), email.trim(), password)
            await login(email.trim(), password)
          }
        })(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('请求超时，请检查网络后重试')), 15000)
        ),
      ])
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '操作失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div
        ref={modalRef}
        className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-xl w-[380px] max-w-[90vw] font-ui"
      >
        {/* Header tabs */}
        <div className="flex items-center justify-between px-5 pt-4 pb-0">
          <div className="flex gap-3">
            <button
              onClick={() => setTab('login')}
              className={`text-sm pb-2 border-b-2 transition-colors ${
                tab === 'login'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                  : 'border-transparent text-[var(--color-text-secondary)]'
              }`}
            >
              登录
            </button>
            <button
              onClick={() => setTab('register')}
              className={`text-sm pb-2 border-b-2 transition-colors ${
                tab === 'register'
                  ? 'border-[var(--color-accent)] text-[var(--color-accent)] font-medium'
                  : 'border-transparent text-[var(--color-text-secondary)]'
              }`}
            >
              注册
            </button>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          {tab === 'register' && (
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用户名"
              className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          )}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            autoComplete="email"
            className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
            className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
          />
          {tab === 'register' && (
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="确认密码"
              autoComplete="new-password"
              className="w-full text-sm px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] focus:outline-none focus:border-[var(--color-accent)]"
            />
          )}

          {error && (
            <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-[var(--color-accent)] text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? '处理中...' : tab === 'login' ? '登  录' : '注  册'}
          </button>
        </form>
      </div>
    </div>
  )
}
