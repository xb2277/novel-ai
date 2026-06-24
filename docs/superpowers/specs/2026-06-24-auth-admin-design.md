# 用户登录 + 后台管理系统 设计文档

**日期**: 2026-06-24  
**分支**: main  
**后端**: Supabase (BaaS)

---

## 存储边界

| 存储位置 | 内容 |
|----------|------|
| **Supabase (云端)** | 小说标题、简介、大纲树、章节列表（标题+正文+字数）、当前编辑章节、时间戳 |
| **localStorage (仅本地)** | AI 对话记录、用户设置（API Key、模型选择、背景颜色） |

> API Key 输入框旁标注：「🔒 API Key 仅保存在本地浏览器，多设备使用时需要重新设置」

### 登录/未登录行为一致

无论是否登录，用户均可正常使用编辑器的全部功能（包括 AI 对话）。登录仅带来云端同步能力，不影响任何本地功能。

---

## 架构概览

```
浏览器                        Supabase
┌──────────────────┐         ┌─────────────────┐
│  笔灵前端 (Vite)  │  SDK    │  Auth (认证)     │
│                  │ ←────→ │  Database (PG)  │
│  /     编辑器     │         │  RLS (行级安全)  │
│  /admin 管理后台  │         └─────────────────┘
│                  │
│  localStorage    │ ← 对话/设置永久留本地
└──────────────────┘
```

- **前端** 仍部署在 GitHub Pages，通过 Supabase SDK 直连后端
- **认证** 使用 Supabase Auth（邮箱 + 密码）
- **数据库** 使用 Supabase PostgreSQL，RLS 策略保证用户数据隔离
- **管理员** 普通用户带 `is_admin` 标记

---

## 数据模型

### Supabase 数据库表

```sql
-- 用户扩展信息（关联 Supabase auth.users）
profiles (
  id uuid PK references auth.users,
  username text UNIQUE NOT NULL,
  is_admin boolean DEFAULT false,
  is_disabled boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)

-- 大纲节点（每本小说的大纲树）
outline_nodes (
  id uuid PK DEFAULT gen_random_uuid(),
  novel_id uuid REFERENCES novels(id) ON DELETE CASCADE NOT NULL,
  parent_id uuid REFERENCES outline_nodes(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text DEFAULT '',
  sort_order int NOT NULL DEFAULT 0,
  expanded boolean DEFAULT true
)

-- 章节（每本小说的章节列表）
chapters (
  id uuid PK DEFAULT gen_random_uuid(),
  novel_id uuid REFERENCES novels(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  content text DEFAULT '',
  word_count int DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- 用户的小说项目
novels (
  id uuid PK DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) NOT NULL,
  title text NOT NULL DEFAULT '未命名作品',
  intro text DEFAULT '',
  current_chapter_id uuid REFERENCES chapters(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
```

### RLS 策略

```sql
-- 通用：用户只能操作自己的数据；管理员可读/管理所有

-- novels
CREATE POLICY "Users own novels" ON novels
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admin reads all novels" ON novels
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- chapters: 通过 novel 判断所有权
CREATE POLICY "Users own chapters" ON chapters
  FOR ALL USING (
    EXISTS (SELECT 1 FROM novels WHERE novels.id = chapters.novel_id AND novels.user_id = auth.uid())
  );
CREATE POLICY "Admin reads all chapters" ON chapters
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- outline_nodes: 同理
CREATE POLICY "Users own outlines" ON outline_nodes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM novels WHERE novels.id = outline_nodes.novel_id AND novels.user_id = auth.uid())
  );
CREATE POLICY "Admin reads all outlines" ON outline_nodes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- profiles
CREATE POLICY "Users own profile" ON profiles
  FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admin reads all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

### 管理员初始化

部署时通过 Supabase SQL Editor 插入默认管理员。

---

## 前端数据流

### 登录/未登录行为一致

无论是否登录，用户均可正常使用全部功能。登录仅带来云端同步能力。

### 数据分存规则

| 操作 | localStorage | Supabase |
|------|:---:|:---:|
| 读/写设置 + API Key | ✅ | ❌ |
| 读/写对话记录 | ✅ | ❌ |
| 读/写小说数据（未登录） | ✅ | ❌ |
| 读/写小说数据（已登录） | ✅ | ✅ 双写 |
| 换设备恢复（已登录） | — | ✅ 拉取覆盖本地 |

### 登录时

- 从 Supabase 拉取该用户所有小说数据，合并/覆盖本地 localStorage
- 登录后写操作双写 local + Supabase

### 登出时

- 清除 Supabase session，本地数据保留
- 下次登录再次从 Supabase 拉取覆盖

### 数据同步策略（首版简化）

- **写操作**：每次修改后 debounce 调用 Supabase upsert
- **冲突**：不做冲突检测，最后写入胜出
- **离线**：数据正常写 localStorage，在线时触发重试同步

---

## UI 设计

### 顶栏（登录前）

```
[☰ 笔灵] ................ [设置] [书架] [AI面板] [登录]
```

### 顶栏（登录后）

```
[☰ 笔灵] ................ [设置] [书架] [AI面板] [admin ▼]
                                                    │ 后台管理  ← 仅管理员
                                                    │ 登出
```

### 登录/注册弹窗

```
┌──────────────────────────────┐
│            ✕                 │
│                              │
│     [登录]  [注册]          │  ← Tab 切换
│                              │
│  登录模式:                    │
│  ┌──────────────────────┐    │
│  │ 📧 邮箱              │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 🔒 密码              │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │      登  录          │    │
│  └──────────────────────┘    │
│                              │
│  注册模式:                    │
│  ┌──────────────────────┐    │
│  │ 👤 用户名            │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 📧 邮箱              │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 🔒 密码              │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 🔒 确认密码          │    │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │      注  册          │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

### 后台管理页面 (/admin)

```
┌────────────────────────────────────────┐
│  ← 返回编辑器         笔灵 管理后台    │
├────────────────────────────────────────┤
│  [用户管理]  [内容浏览]                │  ← Tab
├────────────────────────────────────────┤
│                                        │
│  用户管理 Tab:                          │
│  ┌──────┬──────┬─────┬──────┬──────┐  │
│  │用户名 │ 邮箱  │角色  │ 状态  │ 操作 │  │
│  ├──────┼──────┼─────┼──────┼──────┤  │
│  │ admin │ a@.. │管理员│ 正常  │  -   │  │
│  │ user1 │ u@.. │ 用户 │ 正常  │ 禁用 │  │
│  │ user2 │ 2@.. │ 用户 │ 已禁 │ 启用 │  │
│  └──────┴──────┴─────┴──────┴──────┘  │
│                                        │
│  内容浏览 Tab:                          │
│  用户: [选择用户 ▼]                     │
│  ┌──────────┬─────┬──────┬─────────┐  │
│  │ 小说名    │ 章节 │ 字数  │ 更新时间 │  │
│  ├──────────┼─────┼──────┼─────────┤  │
│  │ 修仙传   │  12  │ 3.2万 │ 06-24   │  │
│  │ 未命名   │   1  │  500  │ 06-23   │  │
│  └──────────┴─────┴──────┴─────────┘  │
└────────────────────────────────────────┘
```

---

## 路由方案

使用 `react-router-dom`，两个路由：

| 路由 | 组件 | 说明 |
|------|------|------|
| `/` | App | 编辑器主页（现有） |
| `/admin` | AdminPage | 后台管理面板（仅管理员可访问） |

GitHub Pages 静态托管需要处理 SPA 路由：在 `dist/` 里放一个 `404.html` 做重定向，或使用 Hash Router。

**推荐 Hash Router**（`#/` 和 `#/admin`）— 最简单，无需服务端配置。

---

## 实现步骤

### Phase 1: Supabase 集成 + 认证

1. 创建 Supabase 项目，建表，配置 RLS
2. 安装依赖：`@supabase/supabase-js`、`react-router-dom`
3. `src/services/supabase.ts` — Supabase 客户端初始化
4. `src/services/auth.ts` — 注册/登录/登出/获取当前用户
5. `src/components/AuthModal.tsx` — 登录注册弹窗
6. `src/components/UserMenu.tsx` — 登录后用户名下拉菜单
7. `App.tsx` — 顶栏右侧加入登录按钮/用户菜单

### Phase 2: 数据同步

8. `src/services/sync.ts` — 小说数据的拉取/上传/合并
9. `useStore.ts` — 登录后触发数据同步

### Phase 3: 管理后台

10. `src/main.tsx` — 配置 Hash Router
11. `src/pages/AdminPage.tsx` — 管理后台页面
12. `src/services/admin.ts` — 管理员 API（用户列表、内容查询）

---

## 注意事项

- Hash Router（`#/`、`#/admin`）不需要服务端配置，GitHub Pages 天然支持
- 所有请求走 Supabase SDK，不经过代理服务器
- 注册页面需做密码长度校验（≥6位）+ 确认密码一致
- 管理员不可禁用自己，不可删除自己
- 管理员初始密码 `admin123`，首次登录后可修改
- 设置页 API Key 输入框旁标注：「🔒 API Key 仅保存在本地浏览器，多设备使用时需要重新设置」
- AI 对话记录不存数据库，仅 localStorage，换设备后对话不跟随
