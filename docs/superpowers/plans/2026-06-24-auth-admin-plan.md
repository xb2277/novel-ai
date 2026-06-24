# 用户登录 + 后台管理 实现计划

> **For agentic workers:** 使用 superpowers:subagent-driven-development 逐个 Task 实现。Step 使用 checkbox (`- [ ]`) 语法跟踪。

**Goal:** 为"笔灵"添加 Supabase 用户认证和数据同步，以及 `/admin` 后台管理面板

**Architecture:** Supabase Auth + PostgreSQL（RLS），前端直连，Hash Router 路由 `/` 和 `/admin`

**Tech Stack:** React 19, TypeScript 6, Zustand, react-router-dom, @supabase/supabase-js

## Global Constraints

- Supabase URL: `https://wfvahgpjghevbdnkeaqq.supabase.co`
- Supabase Anon Key: `sb_publishable_RtT624SRQ-ThGTRbs502tA_Y68aMcPv`
- Hash Router（`#/`、`#/admin`），无需服务端路由配置
- 小说数据双写（localStorage + Supabase），对话/设置仅 localStorage
- API Key 输入框旁标注「仅保存本地」
- 注册: 用户名+邮箱+密码+确认密码，登录: 邮箱+密码
- 初始管理员: admin@example.com / admin123

## File Structure

```
src/
  services/
    supabase.ts          # Supabase 客户端初始化
    authService.ts       # 注册/登录/登出/session
    syncService.ts       # 小说数据同步（上传/拉取）
    adminService.ts      # 管理员 API
  components/
    AuthModal.tsx        # 登录/注册弹窗
    UserMenu.tsx         # 登录后下拉菜单
  pages/
    AdminPage.tsx        # 后台管理页面
  stores/
    authStore.ts         # 认证状态 slice（独立 store）
  App.tsx                # [MODIFY] 顶栏加登录/用户菜单
  main.tsx               # [MODIFY] 包装 HashRouter
```

Data flow:
```
AuthModal → authService → Supabase Auth
AuthModal → authStore (user state)
syncService → Supabase REST / RLS → novels+chapters+outline_nodes tables
AdminPage → adminService → Supabase (admin RLS bypass)
```

---

### Task 1: Supabase 数据库建表 + 初始化管理员

**Files:**
- Create: `supabase/migrations/001_init.sql`

**Interfaces:**
- Produces: `profiles`, `novels`, `chapters`, `outline_nodes` 表 + RLS 策略 + 管理员账号

- [ ] 在 Supabase Dashboard → SQL Editor 执行：

```sql
-- 用户扩展信息表
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  is_disabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 小说表
CREATE TABLE IF NOT EXISTS novels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL DEFAULT '未命名作品',
  intro text DEFAULT '',
  current_chapter_id uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid REFERENCES novels(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  word_count int DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 大纲节点表
CREATE TABLE IF NOT EXISTS outline_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id uuid REFERENCES novels(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES outline_nodes(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  expanded boolean DEFAULT true
);

-- 外键: novels.current_chapter_id → chapters
ALTER TABLE novels ADD CONSTRAINT fk_current_chapter
  FOREIGN KEY (current_chapter_id) REFERENCES chapters(id) ON DELETE SET NULL;

-- ===== RLS =====
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE outline_nodes ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admin selects all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
CREATE POLICY "Admin updates profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- novels
CREATE POLICY "Users own novels" ON novels
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admin reads all novels" ON novels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- chapters
CREATE POLICY "Users own chapters" ON chapters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM novels WHERE novels.id = chapters.novel_id AND novels.user_id = auth.uid())
  );
CREATE POLICY "Admin reads all chapters" ON chapters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- outline_nodes
CREATE POLICY "Users own outlines" ON outline_nodes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM novels WHERE novels.id = outline_nodes.novel_id AND novels.user_id = auth.uid())
  );
CREATE POLICY "Admin reads all outlines" ON outline_nodes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ===== 函数: 注册时自动创建 profile =====
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (id, username, is_admin)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）再创建
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

- [ ] 创建管理员账号：Supabase Dashboard → Authentication → Users → Add User
  - Email: `admin@example.com`
  - Password: `admin123`
  - 勾选 "Auto Confirm User"
- [ ] 在 SQL Editor 执行：`UPDATE profiles SET is_admin = true WHERE id = '<admin_user_id>';`

---

### Task 2: 安装依赖 + Supabase 客户端

- [ ] 安装依赖：

```bash
cd /Users/zpmacmini/Documents/Trae项目/novel-ai
npm install @supabase/supabase-js react-router-dom
```

- [ ] 创建 `src/services/supabase.ts`：

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://wfvahgpjghevbdnkeaqq.supabase.co'
const supabaseAnonKey = 'sb_publishable_RtT624SRQ-ThGTRbs502tA_Y68aMcPv'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

- [ ] Commit:

```bash
git add -A && git commit -m "chore: 安装 Supabase SDK + react-router-dom，初始化客户端"
```

---

### Task 3: 认证服务 + 认证 Store

**Files:**
- Create: `src/services/authService.ts`
- Create: `src/stores/authStore.ts`

**Interfaces:**
- Produces:
  - `authService.register(username, email, password): Promise<User>`
  - `authService.login(email, password): Promise<User>`
  - `authService.logout(): Promise<void>`
  - `authService.getCurrentUser(): Promise<User | null>`
  - `authStore.user: User | null`
  - `authStore.isAdmin: boolean`
  - `authStore.setUser(user)`
  - `authStore.clearUser()`

- [ ] 创建 `src/stores/authStore.ts`：

```typescript
import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  isAdmin: boolean
  setUser: (user: User | null, isAdmin?: boolean) => void
  clearUser: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAdmin: false,
  setUser: (user, isAdmin = false) => set({ user, isAdmin }),
  clearUser: () => set({ user: null, isAdmin: false }),
}))
```

- [ ] 创建 `src/services/authService.ts`：

```typescript
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'

export async function register(
  username: string, email: string, password: string
): Promise<void> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username },
    },
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('注册失败，请稍后重试')
}

export async function login(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('登录失败')
  await loadUserProfile(data.user)
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut()
  useAuthStore.getState().clearUser()
}

async function loadUserProfile(user: import('@supabase/supabase-js').User): Promise<void> {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin, is_disabled')
    .eq('id', user.id)
    .single()

  if (data?.is_disabled) {
    await supabase.auth.signOut()
    throw new Error('账号已被禁用')
  }

  useAuthStore.getState().setUser(user, data?.is_admin ?? false)
}

export async function restoreSession(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    try {
      await loadUserProfile(session.user)
    } catch {
      useAuthStore.getState().clearUser()
    }
  }
}

// Listen for auth state changes
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_IN' && session?.user) {
    try { await loadUserProfile(session.user) }
    catch { useAuthStore.getState().clearUser() }
  }
  if (event === 'SIGNED_OUT') {
    useAuthStore.getState().clearUser()
  }
})
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: 认证服务 + auth store — 注册/登录/登出/session恢复"
```

---

### Task 4: AuthModal 登录/注册弹窗

**Files:**
- Create: `src/components/AuthModal.tsx`

**Interfaces:**
- Consumes: `authService.register`, `authService.login`, `authStore`
- Produces: `<AuthModal open={boolean} onClose={() => void} />`

- [ ] 创建 `src/components/AuthModal.tsx`：

```typescript
import { useState, useRef, useEffect } from 'react'
import { register, login } from '../services/authService'
import { useAuthStore } from '../stores/authStore'

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

  // Reset on tab switch
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
      if (tab === 'login') {
        await login(email.trim(), password)
      } else {
        await register(username.trim(), email.trim(), password)
        // Auto-login after register
        await login(email.trim(), password)
      }
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
        {/* Header */}
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

        {/* Body */}
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
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: AuthModal 登录/注册弹窗组件"
```

---

### Task 5: UserMenu 下拉菜单 + App.tsx 集成

**Files:**
- Create: `src/components/UserMenu.tsx`
- Modify: `src/App.tsx` — 顶栏右侧加入登录按钮 / 用户菜单

**Interfaces:**
- Consumes: `authStore.user`, `authStore.isAdmin`, `authService.logout`

- [ ] 创建 `src/components/UserMenu.tsx`：

```typescript
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
        <div className="absolute right-0 top-full mt-1 w-[160px] bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] shadow-lg z-50 py-1">
          {isAdmin && (
            <a
              href="#/admin"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
            >
              后台管理
            </a>
          )}
          <button
            onClick={() => { setMenuOpen(false); logout() }}
            className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-bg)] transition-colors"
          >
            登出
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] 修改 `src/App.tsx` — 顶栏右侧加入 UserMenu，放在 Settings 按钮之前：

```typescript
// 在 import 中添加:
import UserMenu from './components/UserMenu'

// 在 header 右侧区域，Settings 按钮前插入:
<div className="flex items-center gap-1 relative">
  <UserMenu />
  <button onClick={() => setShowSettings(!showSettings)} ...>
```

- [ ] 修改 `src/main.tsx` — 在 App 挂载时恢复 session：

```typescript
// 添加:
import { restoreSession } from './services/authService'

// 在 createRoot 之前:
restoreSession()
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: UserMenu 下拉 + App 集成登录/登出/后台入口"
```

---

### Task 6: 小说数据同步服务

**Files:**
- Create: `src/services/syncService.ts`

**Interfaces:**
- Consumes: `supabase`, `authStore.user`
- Produces:
  - `syncService.pullNovels(): Promise<Novel[]>` — 从 Supabase 拉取
  - `syncService.pushNovel(novel: Novel): Promise<void>` — 上传单本小说
  - `syncService.deleteNovel(id: string): Promise<void>` — 删除

- [ ] 创建 `src/services/syncService.ts`：

```typescript
import { supabase } from './supabase'
import { useAuthStore } from '../stores/authStore'
import type { Novel, Chapter, OutlineNode } from '../stores/types'

// ===== Pull: 拉取所有用户小说 =====
export async function pullNovels(): Promise<Novel[]> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return []

  const { data: novels, error } = await supabase
    .from('novels')
    .select(`
      *,
      chapters(*),
      outline_nodes(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  if (!novels) return []

  return novels.map((n: any) => {
    const chapters: Chapter[] = (n.chapters || [])
      .sort((a: any, b: any) => a.sort_order - b.sort_order)
      .map((c: any) => ({
        id: c.id, title: c.title, content: c.content,
        wordCount: c.word_count, createdAt: c.created_at, updatedAt: c.updated_at,
      }))

    const outlines = buildOutlineTree(n.outline_nodes || [])

    return {
      id: n.id, title: n.title, intro: n.intro,
      outlines,
      chapters,
      currentChapterId: n.current_chapter_id,
      conversations: [], // Not stored in DB
      activeConversationId: null,
      createdAt: n.created_at, updatedAt: n.updated_at,
    }
  })
}

function buildOutlineTree(nodes: any[]): OutlineNode[] {
  const map = new Map<string, OutlineNode>()
  const roots: OutlineNode[] = []

  for (const n of nodes) {
    map.set(n.id, {
      id: n.id, title: n.title, content: n.content,
      expanded: n.expanded, children: [],
    })
  }
  for (const n of nodes) {
    const node = map.get(n.id)!
    if (n.parent_id && map.has(n.parent_id)) {
      map.get(n.parent_id)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// ===== Push: 上传一本小说 =====
export async function pushNovel(novel: Novel): Promise<void> {
  const userId = useAuthStore.getState().user?.id
  if (!userId) return

  const { error: novelErr } = await supabase.from('novels').upsert({
    id: novel.id,
    user_id: userId,
    title: novel.title,
    intro: novel.intro,
    current_chapter_id: novel.currentChapterId,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' })
  if (novelErr) throw new Error(novelErr.message)

  // Push chapters
  const chapterRows = novel.chapters.map((c, i) => ({
    id: c.id, novel_id: novel.id, title: c.title,
    content: c.content, word_count: c.wordCount,
    sort_order: i, updated_at: new Date().toISOString(),
  }))
  if (chapterRows.length > 0) {
    const { error: chErr } = await supabase.from('chapters').upsert(chapterRows, { onConflict: 'id' })
    if (chErr) throw new Error(chErr.message)
  }

  // Push outline nodes (delete existing first, then insert)
  const { error: delErr } = await supabase.from('outline_nodes').delete().eq('novel_id', novel.id)
  if (delErr) throw new Error(delErr.message)

  const outlineRows = flattenOutlines(novel.outlines, novel.id, null)
  if (outlineRows.length > 0) {
    const { error: outErr } = await supabase.from('outline_nodes').insert(outlineRows)
    if (outErr) throw new Error(outErr.message)
  }
}

function flattenOutlines(
  nodes: OutlineNode[], novelId: string, parentId: string | null, startIdx = 0
): any[] {
  const rows: any[] = []
  nodes.forEach((n, i) => {
    rows.push({
      id: n.id, novel_id: novelId, parent_id: parentId,
      title: n.title, content: n.content,
      expanded: n.expanded, sort_order: startIdx + i,
    })
    if (n.children.length > 0) {
      rows.push(...flattenOutlines(n.children, novelId, n.id, 0))
    }
  })
  return rows
}

// ===== Delete =====
export async function deleteNovelRemote(id: string): Promise<void> {
  const { error } = await supabase.from('novels').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: 小说数据同步服务 — pull/push/delete"
```

---

### Task 7: Store 集成同步逻辑

**Files:**
- Modify: `src/stores/useStore.ts` — 登录后拉取数据，写操作双写

- [ ] 在 `useStore.ts` 中添加同步逻辑：

在 store 创建后添加登录监听：

```typescript
// 在 useStore 定义之后添加:
import { useAuthStore } from './authStore'
import { pullNovels, pushNovel, deleteNovelRemote } from '../services/syncService'

// 监听登录状态，拉取云端数据
let lastUserId: string | null = null
useAuthStore.subscribe((state) => {
  const currentId = state.user?.id ?? null
  if (currentId && currentId !== lastUserId) {
    lastUserId = currentId
    pullNovels().then((cloudNovels) => {
      if (cloudNovels.length === 0) {
        // Push local novels to cloud on first login
        const localNovels = useStore.getState().novels
        localNovels.forEach((n) => pushNovel(n).catch(() => {}))
        return
      }
      // Merge: cloud wins, but preserve local conversations
      const localNovels = useStore.getState().novels
      const merged = cloudNovels.map((cn) => {
        const local = localNovels.find((ln) => ln.id === cn.id)
        if (local) {
          cn.conversations = local.conversations
          cn.activeConversationId = local.activeConversationId
        }
        return cn
      })
      useStore.setState({ novels: merged, currentNovelId: merged[0]?.id ?? null })
    }).catch(() => {})
  }
  if (!currentId) {
    lastUserId = null
  }
})
```

修改 `deleteNovel` — 如果已登录则同时删除远端：

```typescript
deleteNovel: (id) => {
  // ... existing deleteNovel logic ...
  // Add after set:
  if (useAuthStore.getState().user) {
    deleteNovelRemote(id).catch(() => {})
  }
},
```

- [ ] 对 `saveChapterContent`、`setNovelTitle`、`addChapter` 等关键写操作，添加 debounced push：

在文件顶部添加 debounce helper，在写操作后调用 `syncCurrentNovel()`：

```typescript
let syncTimer: ReturnType<typeof setTimeout>
function syncCurrentNovel() {
  if (!useAuthStore.getState().user) return
  clearTimeout(syncTimer)
  syncTimer = setTimeout(() => {
    const s = useStore.getState()
    const novel = s.novels.find((n) => n.id === s.currentNovelId)
    if (novel) {
      const snap = snapshotNovel(s)
      pushNovel({ ...novel, ...snap }).catch(() => {})
    }
  }, 2000)
}
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: Store 集成云端同步 — 登录拉取 + 写操作双写"
```

---

### Task 8: Hash Router + AdminPage 后台管理

**Files:**
- Create: `src/services/adminService.ts`
- Create: `src/pages/AdminPage.tsx`
- Modify: `src/main.tsx` — HashRouter 包装

- [ ] 创建 `src/services/adminService.ts`：

```typescript
import { supabase } from './supabase'

export async function fetchAllUsers() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function toggleUserDisabled(userId: string, disabled: boolean) {
  const { error } = await supabase.from('profiles').update({ is_disabled: disabled }).eq('id', userId)
  if (error) throw new Error(error.message)
}

export async function fetchAllNovels() {
  const { data, error } = await supabase.from('novels').select(`
    *,
    profiles:user_id (username, email),
    chapters:chapters (id)
  `).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchUserNovels(userId: string) {
  const { data, error } = await supabase.from('novels').select(`
    *,
    chapters:chapters (id, word_count)
  `).eq('user_id', userId).order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data
}
```

- [ ] 创建 `src/pages/AdminPage.tsx`（完整组件，含用户管理 Tab 和内容浏览 Tab）

- [ ] 修改 `src/main.tsx` — HashRouter：

```typescript
import { HashRouter, Routes, Route } from 'react-router-dom'
import AdminPage from './pages/AdminPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/*" element={<App />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>,
)
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: HashRouter + AdminPage 后台管理面板"
```

---

### Task 9: Settings API Key 安全提示

**Files:**
- Modify: `src/components/SettingsMenu.tsx` — API Key 输入框旁加提示

- [ ] 在 API Key 输入框下方添加：

```tsx
<p className="text-[10px] text-[var(--color-text-secondary)]/60 mt-1 flex items-center gap-1">
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" /></svg>
  API Key 仅保存在本地浏览器，多设备使用时需重新设置
</p>
```

- [ ] Commit:

```bash
git add -A && git commit -m "feat: Settings API Key 安全提示"
git push
```

