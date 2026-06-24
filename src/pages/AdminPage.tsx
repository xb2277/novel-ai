import { useState, useEffect } from 'react'
import { useAuthStore } from '../stores/authStore'
import { fetchAllUsers, toggleUserDisabled, fetchUserNovels } from '../services/adminService'

export default function AdminPage() {
  const { user: me, isAdmin, loaded } = useAuthStore()
  const [tab, setTab] = useState<'users' | 'content'>('users')
  const [users, setUsers] = useState<any[]>([])
  const [selectedUser, setSelectedUser] = useState<string | null>(null)
  const [novels, setNovels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load users on mount
  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    fetchAllUsers()
      .then((data) => { setUsers(data) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [isAdmin])

  // Loading — waiting for auth state to be determined
  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3 font-ui text-[var(--color-text-secondary)]">
        <div className="w-6 h-6 border-2 border-[var(--color-border)] border-t-[var(--color-accent)] rounded-full animate-spin" />
        <p className="text-xs">验证权限中...</p>
      </div>
    )
  }

  // Not admin, not logged in
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 font-ui text-[var(--color-text-secondary)]">
        <div className="text-4xl opacity-30">🔒</div>
        <p className="text-sm">无访问权限，请用管理员账号登录</p>
        <a href="#/" className="text-sm text-[var(--color-accent)] hover:underline">返回编辑器登录</a>
      </div>
    )
  }

  const handleToggleDisable = async (userId: string, currentDisabled: boolean) => {
    if (userId === me?.id) return // Can't disable self
    try {
      await toggleUserDisabled(userId, !currentDisabled)
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_disabled: !currentDisabled } : u))
      )
    } catch (e: any) {
      setError(e.message)
    }
  }

  const handleLoadUserNovels = async (userId: string) => {
    setSelectedUser(userId)
    setLoading(true)
    try {
      const data = await fetchUserNovels(userId)
      setNovels(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="h-screen flex flex-col font-ui bg-[var(--color-bg)]">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <a href="#/" className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] transition-colors no-underline">
          ← 返回编辑器
        </a>
        <h1 className="text-sm font-semibold text-[var(--color-text)]">
          笔灵 管理后台
        </h1>
      </header>

      {/* Tab bar */}
      <div className="flex gap-1 px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)] shrink-0">
        <button
          onClick={() => setTab('users')}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
            tab === 'users'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
          }`}
        >
          用户管理
        </button>
        <button
          onClick={() => setTab('content')}
          className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
            tab === 'content'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg)]'
          }`}
        >
          内容浏览
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-5">
        {error && (
          <p className="text-xs text-red-500 bg-red-50 px-3 py-2 rounded mb-4">{error}</p>
        )}

        {tab === 'users' && (
          <div className="card overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <th className="text-left py-2 px-3 font-medium">用户名</th>
                  <th className="text-left py-2 px-3 font-medium">角色</th>
                  <th className="text-left py-2 px-3 font-medium">状态</th>
                  <th className="text-left py-2 px-3 font-medium">注册时间</th>
                  <th className="text-right py-2 px-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg)]/50">
                    <td className="py-2.5 px-3">
                      <span className="text-[var(--color-text)]">{u.username}</span>
                      {u.id === me?.id && (
                        <span className="text-[10px] text-[var(--color-accent)] ml-1">(你)</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        u.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {u.is_admin ? '管理员' : '用户'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        u.is_disabled ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {u.is_disabled ? '已禁用' : '正常'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[var(--color-text-secondary)] text-xs">
                      {new Date(u.created_at).toLocaleDateString('zh-CN')}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => handleToggleDisable(u.id, u.is_disabled)}
                        disabled={u.id === me?.id}
                        className={`text-xs px-2 py-1 rounded transition-colors ${
                          u.id === me?.id
                            ? 'text-[var(--color-text-secondary)]/30 cursor-not-allowed'
                            : u.is_disabled
                              ? 'text-green-600 hover:bg-green-50'
                              : 'text-red-500 hover:bg-red-50'
                        }`}
                      >
                        {u.id === me?.id ? '—' : u.is_disabled ? '启用' : '禁用'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[var(--color-text-secondary)] text-xs">
                      暂无用户数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {loading && (
              <div className="text-center py-4 text-xs text-[var(--color-text-secondary)]">加载中...</div>
            )}
          </div>
        )}

        {tab === 'content' && (
          <div className="space-y-4">
            {/* User selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-text-secondary)]">选择用户：</span>
              <select
                value={selectedUser || ''}
                onChange={(e) => {
                  if (e.target.value) handleLoadUserNovels(e.target.value)
                }}
                className="text-xs px-3 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] focus:outline-none focus:border-[var(--color-accent)]"
              >
                <option value="">— 选择 —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
            </div>

            {/* Novel list */}
            {selectedUser && (
              <div className="card overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)]">
                      <th className="text-left py-2 px-3 font-medium">小说名</th>
                      <th className="text-left py-2 px-3 font-medium">章节数</th>
                      <th className="text-left py-2 px-3 font-medium">总字数</th>
                      <th className="text-left py-2 px-3 font-medium">更新时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {novels.map((n) => {
                      const chapterCount = n.chapters?.length || 0
                      const totalWords = n.chapters?.reduce(
                        (sum: number, c: any) => sum + (c.word_count || 0), 0
                      ) || 0
                      return (
                        <tr key={n.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-bg)]/50">
                          <td className="py-2.5 px-3 text-[var(--color-text)]">{n.title}</td>
                          <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">{chapterCount} 章</td>
                          <td className="py-2.5 px-3 text-[var(--color-text-secondary)]">{totalWords.toLocaleString()} 字</td>
                          <td className="py-2.5 px-3 text-[var(--color-text-secondary)] text-xs">
                            {new Date(n.updated_at).toLocaleDateString('zh-CN')}
                          </td>
                        </tr>
                      )
                    })}
                    {novels.length === 0 && !loading && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-[var(--color-text-secondary)] text-xs">
                          该用户暂无小说
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                {loading && (
                  <div className="text-center py-4 text-xs text-[var(--color-text-secondary)]">加载中...</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
